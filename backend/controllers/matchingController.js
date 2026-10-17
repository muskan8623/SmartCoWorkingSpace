const Workspace = require("../models/Workspace");
const Availability = require("../models/Availability");

const calculateCapacityScore = (workspace, teamSize) => {
  if (!teamSize || teamSize <= 0) {
    return 100;
  }

  if (workspace.capacity < teamSize) {
    return 0;
  }

  const extraCapacity =
    workspace.capacity - teamSize;

  const extraCapacityPercentage =
    extraCapacity / teamSize;

  if (extraCapacityPercentage <= 0.25) {
    return 100;
  }

  if (extraCapacityPercentage <= 0.5) {
    return 90;
  }

  if (extraCapacityPercentage <= 1) {
    return 75;
  }

  return 60;
};

const calculateBudgetScore = (workspace, budget) => {
  if (!budget || budget <= 0) {
    return 100;
  }

  const price = workspace.pricing.amount;

  if (price <= budget) {
    return 100;
  }

  const differencePercentage =
    ((price - budget) / budget) * 100;

  if (differencePercentage <= 10) {
    return 90;
  }

  if (differencePercentage <= 20) {
    return 75;
  }

  if (differencePercentage <= 30) {
    return 50;
  }

  return 0;
};

const calculateLocationScore = (workspace, city) => {
  if (!city) {
    return 100;
  }

  if (
    workspace.location?.city?.toLowerCase() ===
    city.trim().toLowerCase()
  ) {
    return 100;
  }

  return 0;
};

const calculateAmenitiesScore = (
  workspace,
  requestedAmenities = []
) => {
  if (
    !Array.isArray(requestedAmenities) ||
    requestedAmenities.length === 0
  ) {
    return 100;
  }

  const workspaceAmenities = workspace.amenities.map(
    (amenity) => amenity.toLowerCase()
  );

  const matchedAmenities =
    requestedAmenities.filter((amenity) =>
      workspaceAmenities.includes(
        amenity.toLowerCase()
      )
    );

  return (
    (matchedAmenities.length /
      requestedAmenities.length) *
    100
  );
};

const calculateWorkspaceTypeScore = (
  workspace,
  requestedType
) => {
  if (!requestedType) {
    return 100;
  }

  return workspace.workspaceType === requestedType
    ? 100
    : 0;
};

const calculateAreaScore = (workspace, requiredArea) => {
  if (!requiredArea || requiredArea <= 0) {
    return 100;
  }

  const workspaceArea =
    workspace.area?.value || 0;

  if (workspaceArea >= requiredArea) {
    return 100;
  }

  const percentage =
    (workspaceArea / requiredArea) * 100;

  if (percentage >= 90) {
    return 80;
  }

  if (percentage >= 75) {
    return 60;
  }

  return 0;
};

const calculateAvailabilityScore = (
  availability
) => {
  if (!availability) {
    return 50;
  }

  if (availability.status === "available") {
    return 100;
  }

  if (availability.status === "limited") {
    return 70;
  }

  if (availability.status === "full") {
    return 0;
  }

  return 0;
};

const getSmartMatches = async (req, res) => {
  try {
    const {
      teamSize,
      budget,
      city,
      amenities,
      workspaceType,
      area,
    } = req.query;

    const requestedTeamSize =
      Number(teamSize) || 0;

    const requestedBudget =
      Number(budget) || 0;

    const requestedArea =
      Number(area) || 0;

    const requestedAmenities = amenities
      ? amenities
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      : [];

    const workspaces = await Workspace.find({
      isActive: true,
      isVerified: true,
    }).sort({
      createdAt: -1,
    });

    if (workspaces.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No verified workspaces found.",
        data: {
          matches: [],
        },
      });
    }

    const workspaceIds = workspaces.map(
      (workspace) => workspace._id
    );

    const availabilityRecords =
      await Availability.find({
        workspace: {
          $in: workspaceIds,
        },
      });

    const availabilityMap = new Map();

    availabilityRecords.forEach((record) => {
      availabilityMap.set(
        record.workspace.toString(),
        record
      );
    });

    const matches = workspaces.map((workspace) => {
      const availability =
        availabilityMap.get(
          workspace._id.toString()
        );

      const capacityScore =
        calculateCapacityScore(
          workspace,
          requestedTeamSize
        );

      const budgetScore =
        calculateBudgetScore(
          workspace,
          requestedBudget
        );

      const locationScore =
        calculateLocationScore(
          workspace,
          city
        );

      const amenitiesScore =
        calculateAmenitiesScore(
          workspace,
          requestedAmenities
        );

      const workspaceTypeScore =
        calculateWorkspaceTypeScore(
          workspace,
          workspaceType
        );

      const areaScore =
        calculateAreaScore(
          workspace,
          requestedArea
        );

      const availabilityScore =
        calculateAvailabilityScore(
          availability
        );

      const totalScore =
        capacityScore * 0.25 +
        budgetScore * 0.20 +
        locationScore * 0.15 +
        amenitiesScore * 0.15 +
        workspaceTypeScore * 0.10 +
        areaScore * 0.10 +
        availabilityScore * 0.05;

      return {
        workspace,
        availability: availability || null,
        matchScore: Math.round(totalScore),
        scoreBreakdown: {
          capacity: Math.round(
            capacityScore
          ),
          budget: Math.round(
            budgetScore
          ),
          location: Math.round(
            locationScore
          ),
          amenities: Math.round(
            amenitiesScore
          ),
          workspaceType: Math.round(
            workspaceTypeScore
          ),
          area: Math.round(
            areaScore
          ),
          availability: Math.round(
            availabilityScore
          ),
        },
      };
    });

    matches.sort(
      (a, b) =>
        b.matchScore - a.matchScore
    );

    return res.status(200).json({
      success: true,
      message:
        "Smart workspace recommendations generated successfully.",
      data: {
        criteria: {
          teamSize: requestedTeamSize || null,
          budget: requestedBudget || null,
          city: city || null,
          amenities: requestedAmenities,
          workspaceType:
            workspaceType || null,
          area: requestedArea || null,
        },
        matches,
      },
    });
  } catch (error) {
    console.error(
      "Smart matching error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to generate workspace recommendations.",
    });
  }
};

module.exports = {
  getSmartMatches,
};