const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.database();
const auth = admin.auth();

/**
 * Set the configured Firebase user as Admin.
 *
 * The email must match ADMIN_EMAIL configured
 * in Firebase Functions environment/config.
 */
exports.setConfiguredAdmin = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "You must be logged in."
    );
  }

  const configuredEmail = process.env.ADMIN_EMAIL;

  if (!configuredEmail) {
    throw new HttpsError(
      "failed-precondition",
      "ADMIN_EMAIL is not configured."
    );
  }

  const userEmail = String(
    request.auth.token.email || ""
  ).toLowerCase();

  if (userEmail !== configuredEmail.toLowerCase()) {
    throw new HttpsError(
      "permission-denied",
      "You are not authorized to become admin."
    );
  }

  await auth.setCustomUserClaims(
    request.auth.uid,
    {
      admin: true
    }
  );

  return {
    ok: true,
    message: "Admin access enabled."
  };
});


/**
 * Remove admin permission from another user.
 *
 * Only an existing admin can call this.
 */
exports.removeAdmin = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "Authentication required."
    );
  }

  if (request.auth.token.admin !== true) {
    throw new HttpsError(
      "permission-denied",
      "Admin access required."
    );
  }

  const targetUid = request.data?.uid;

  if (!targetUid) {
    throw new HttpsError(
      "invalid-argument",
      "User UID is required."
    );
  }

  if (targetUid === request.auth.uid) {
    throw new HttpsError(
      "invalid-argument",
      "You cannot remove your own admin access."
    );
  }

  const targetUser = await auth.getUser(targetUid);

  await auth.setCustomUserClaims(
    targetUid,
    {
      ...(targetUser.customClaims || {}),
      admin: false
    }
  );

  return {
    ok: true,
    message: "Admin access removed."
  };
});


/**
 * Close a room.
 *
 * Only the room host or an admin can close it.
 */
exports.closeRoom = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "Authentication required."
    );
  }

  const roomId = String(
    request.data?.roomId || ""
  ).trim().toUpperCase();

  if (!roomId) {
    throw new HttpsError(
      "invalid-argument",
      "Room ID is required."
    );
  }

  const roomRef = db.ref(`rooms/${roomId}`);
  const snapshot = await roomRef.once("value");

  if (!snapshot.exists()) {
    throw new HttpsError(
      "not-found",
      "Room not found."
    );
  }

  const room = snapshot.val();

  const isAdmin =
    request.auth.token.admin === true;

  const isHost =
    room.hostUid === request.auth.uid;

  if (!isAdmin && !isHost) {
    throw new HttpsError(
      "permission-denied",
      "Only the host or admin can close this room."
    );
  }

  await roomRef.update({
    status: "closed",
    updatedAt: Date.now()
  });

  return {
    ok: true
  };
});


/**
 * Delete a specific room.
 *
 * Admin only.
 */
exports.deleteRoom = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "Authentication required."
    );
  }

  if (request.auth.token.admin !== true) {
    throw new HttpsError(
      "permission-denied",
      "Admin access required."
    );
  }

  const roomId = String(
    request.data?.roomId || ""
  ).trim().toUpperCase();

  if (!roomId) {
    throw new HttpsError(
      "invalid-argument",
      "Room ID is required."
    );
  }

  await db.ref(`rooms/${roomId}`).remove();

  return {
    ok: true,
    message: "Room deleted."
  };
});


/**
 * Clean old finished/closed rooms.
 *
 * Runs automatically once every 24 hours.
 */
exports.cleanupFinishedRooms = onSchedule(
  "every 24 hours",
  async () => {

    const snapshot = await db
      .ref("rooms")
      .once("value");

    const rooms = snapshot.val() || {};

    const cutoff =
      Date.now() -
      24 * 60 * 60 * 1000;

    const updates = {};

    for (const [roomId, room] of Object.entries(rooms)) {

      if (!room) continue;

      const status = room.status;

      const lastUpdate = Number(
        room.updatedAt ||
        room.createdAt ||
        0
      );

      const oldRoom =
        lastUpdate < cutoff;

      const finished =
        status === "finished" ||
        status === "closed";

      if (finished && oldRoom) {
        updates[`rooms/${roomId}`] = null;
      }
    }

    if (Object.keys(updates).length > 0) {
      await db.ref().update(updates);
    }

    return null;
  }
);
