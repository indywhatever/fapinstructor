import store from "store";
import play from "engine/audio";
import audioLibrary from "audio";
import createNotification, { dismissNotification } from "engine/createNotification";
import { getRandomInclusiveInteger } from "utils/math";
import delay from "utils/delay";
import { edging, getToTheEdge, stopEdging } from "game/actions/orgasm/edge";
import punishment from "game/actions/punishment";
import {
  getRandom_edgeAdvanced_message,
  getRandom_edgeInTime_message,
  getRandom_edgeLadder_message,
  getRandom_hurryUp_message
} from "game/texts/messages";
import executeAction from "engine/executeAction";
import { edge } from "./edge";
import createProbability from "game/utils/createProbability";
import { applyProbability } from "game/actions/generateAction";
import handsOff from "game/actions/speed/handsOff";

/**
 * You have to get to the edge with the current gripStrength, StrokeStyle and StrokeSpeed!
 *
 * @returns {Promise<*>}
 *   the notificationId
 */
export const getToTheEdgeAdvanced = async (message = getRandom_edgeAdvanced_message()) => {

  if (store.config.enableVoice) {
    play(audioLibrary.Edge);
  }
  return createNotification(message, { autoDismiss: false });
};

/**
 * Calls getToTheEdgeAdvanced() then displays an "Edging" button.
 * @returns {Promise<*[]>}
 */
export const edgeAdvanced = async (time, message = getRandom_edgeAdvanced_message()) => {
  const notificationId = await getToTheEdgeAdvanced(message);

  const trigger_edge = async () => {
    dismissNotification(notificationId);
    await edging(time);
    await stopEdging();
  };
  trigger_edge.label = "Edging";

  const trigger_fail = async () => {
    dismissNotification(notificationId);
    await punishment();
  };
  trigger_fail.label = "I can't";

  return [trigger_edge, trigger_fail];
};


/**
 * Initializes the edging ladder.
 *
 * @returns {Promise} action
 *   - the action that may be executed next.
 */
export const initializeEdgingLadder = async () => {
  store.game.edgingLadder = true;
  if (store.config.minimumEdges > 5) {
    store.game.edgingLadderLength = getRandomInclusiveInteger(5, store.config.minimumEdges);
  } else {
    store.game.edgingLadderLength = 5;
  }
  const messageID = createNotification(getRandom_edgeLadder_message(), false);

  const trigger_ok = async () => {
    dismissNotification(messageID);
  };
  trigger_ok.label = "Okay";
  return trigger_ok;
};

/**
 * A task where the user has to do a certain amount of edges in a short time span.
 *
 * @param edgeLadderRung
 *   the current running rung of the edge ladder.
 * @param numberOfEdges
 *   the number of Edges the user has to do.
 * @param numberOfCooldowns
 *   the number of HandsOff tasks the user already did.
 * @returns {Promise<void>}
 */
export const edgingLadder = async (edgeLadderRung = store.game.edgingLadderRung,
                                   numberOfEdges = store.game.edgingLadderLength,
                                   numberOfCooldowns = store.game.edgingLadderCooldowns) => {

  if (edgeLadderRung >= numberOfEdges) {
    store.game.edgingLadder = false;
  }
  if (numberOfCooldowns * 4 < edgeLadderRung) {
    store.game.edgingLadderCooldowns++;
    await handsOff(30);
  }
  if (edgeLadderRung <= 1) {
    await executeAction(edge);
  }
  else if (edgeLadderRung <= numberOfEdges / 2) {
    await executeAction(getRandomEdge());
  }
  else {
    await executeAction(getRandomFinalLadderEdge());
  }
  store.game.edgingLadderRung++;
};

/**
 * DANGER ZONE - Multithreading
 * Checks whether a user reaches the edge in time.
 *
 * @param holdTime
 *   the time the user has to hold the orgasm
 * @param message
 *   the message to be displayed
 * @param timer
 *   the time in seconds in which the user has to reach the edge
 * @param edgeFunc
 *   the edge function
 * @returns {Promise<*[]>}
 */
export const edgeInTime = async (holdTime = getRandomInclusiveInteger(10, 40), message = getRandom_edgeInTime_message(), timer = getRandomInclusiveInteger(10, 40), edgeFunc = getToTheEdge) => {
  const notificationId = await edgeFunc(message);
  let edged = false;
  const trigger_edging = async () => {
    edged = true;
    dismissNotification(notificationId);
    dismissNotification(timerId);
    await edging(holdTime);
    await stopEdging();
  };
  trigger_edging.label = "Edging";

  const countdown = async () => {
    await delay((timer + 1) * 1000);  // Wait till the timer runs up
    // now check whether user did reach the edge in time
    if (!edged) {
      dismissNotification(notificationId);
      dismissNotification(timerId);
      executeAction(punishment, true); // Interrupts other action (trigger_edging)
    }

  };

  const timerId = createNotification(getRandom_hurryUp_message(), {
    time: timer * 1000
  });

  countdown();  // don't wait for the promise just start the thread.

  return [trigger_edging];
};

/**
 *
 * @param holdTime
 *   how long the user will have to hold the edge.
 * @param message
 *   the message to be displayed
 * @returns {Promise<*[]>}
 *   the trigger(s) to be handed to the action generator next.
 */
export const edgeAdvancedInTime = async (holdTime = getRandomInclusiveInteger(10, 40), message = getRandom_edgeInTime_message()) => {
  const timer = getRandomInclusiveInteger(20, 60);
  return await edgeInTime(holdTime, message, timer, getToTheEdgeAdvanced);
};

/**
 * Fetches one of all edges.
 * Difficulty: mostly Easy
 * @returns {action}
 *   A random action
 */
export const getRandomEdge = () => {
  const chosenActions = initializeEdges();
  return applyProbability(chosenActions, 1)[0];
};

/**
 * Fetches one of all edges.
 * Difficulty: mostly Hard
 * @returns {action}
 *   A random action
 */
export const getRandomFinalLadderEdge = () => {
  const chosenActions = initializeFinalLadderEdges();
  return applyProbability(chosenActions, 1)[0];
};

/**
 * Manually created list of all edges:
 * createProbability takes your action and the probability percentage the action will be invoked
 * as a edge.
 *
 * @returns {*[]}
 *   an array with all the function-probability pairs: {func, probability}
 */
export const initializeEdges = () =>
  [
    // list of all available edges
    createProbability(edge, 25),
    createProbability(edgeAdvanced, 25),
    createProbability(edgeInTime, 25),
    createProbability(edgeAdvancedInTime, 15),
    !store.game.edgingLadder && createProbability(initializeEdgingLadder, 5)  // Chose only if not already in edgeLadder
    // TODO edgingLadder can not occur 2 times during one game. This is so by intention atm. (02.09.2018 the1nstructor)
  ].filter(action => !!action);

/**
 * Manually created list of all edges with probabilities required in final edgeLadder phase:
 * createProbability takes your action and the probability percentage the action will be invoked
 * as a edge in edge ladder.
 *
 * @returns {*[]}
 *   an array with all the function-probability pairs: {func, probability}
 */
export const initializeFinalLadderEdges = () =>
  [
    // list of all available edges
    createProbability(edge, 10),
    createProbability(edgeAdvanced, 50),
    createProbability(edgeInTime, 50),
    createProbability(edgeAdvancedInTime, 50),
  ].filter(action => !!action);

