const Notification = require("../models/Notification");

const createNotification = async ({
  recipient,
  type,
  title,
  message,
  booking = null,
  workspace = null,
}) => {
  try {
    const notification = await Notification.create({
      recipient,
      type,
      title,
      message,
      booking,
      workspace,
    });

    console.log(
      `Notification created successfully: ${notification._id}`
    );

    return notification;
  } catch (error) {
    console.error("Create notification error:");
    console.error(error);
    throw error;
  }
};

module.exports = {
  createNotification,
};