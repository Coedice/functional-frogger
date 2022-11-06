import "./style.css";
import {fromEvent, merge, interval} from 'rxjs';
import {filter, scan, map} from 'rxjs/operators';

const constants = { // Contains the "magic numbers", i.e. pre-set numbers used in the game
  frogStartCoordinates: {
    x: 250,
    y: 550
  },
  canvasSize: 550,
  bodyWidth: 50,
  tickInterval: 100
} as const

// Types
type Direction = "n"|"e"|"s"|"w";

type Coordinates = Readonly<{
  x: number,
  y: number
}>;

type Body = Readonly<{ // Used for Cars and Frogs. Reusable, and could be applied to more things later on
  coordinates: Coordinates,
  color: string,
  direction: Direction,
  ticksToMove: number
}>;

type Fly = Readonly<{
  isAlive: boolean,
  aliveTicks: number,
  maxAliveTicks: number,
  deadTicks: number,
  maxDeadTicks: number,
  coordinates: Coordinates,
  color: string,
  pointsValue: number,
  eaten: boolean
}>;

type River = Readonly<{
  fromCoordinates: Coordinates,
  toCoordinates: Coordinates
  color: string
}>;

type Log = Readonly<{
  fromCoordinates: Coordinates,
  toCoordinates: Coordinates
  color: string,
  direction: Direction,
  ticksToMove: number
}>;

type TargetArea = Readonly<{
  coordinates: Coordinates,
  unreachedColor: string,
  reachedColor: string,
  reached: boolean
}>;

type PortalPair = Readonly<{
  // First portal
  portalACoordinates: Coordinates,
  portalAColor: string,

  // Second portal
  portalBCoordinates: Coordinates,
  portalBColor: string
}>;

type GameState = Readonly<{ // The state of the entire game, other state types exist to be placed in attributes of the GameState type
  frog: Body,
  river?: River,
  logs: ReadonlyArray<Log>,
  portalPairs: ReadonlyArray<PortalPair>,
  cars: ReadonlyArray<Body>,
  flies: ReadonlyArray<Fly>
  gameOver: boolean,
  targetAreas: ReadonlyArray<TargetArea>,
  score: number,
  highScore: number
}>;

// Starting state of the game
const initialState: GameState = {
  frog: {
    coordinates: constants.frogStartCoordinates,
    color: "green",
    direction: "n",
    ticksToMove: 0
  },
  river: {
    fromCoordinates: {
      x: 0,
      y: 100
    },
    toCoordinates: {
      x: 600,
      y: 200
    },
    color: "cornflowerblue"
  },
  logs: [
    {
      fromCoordinates: {
        x: 100,
        y: 150
      },
      toCoordinates: {
        x: 250,
        y: 200
      },
      color: "#8B4513",
      direction: "w",
      ticksToMove: 4
    },
    {
      fromCoordinates: {
        x: 400,
        y: 150
      },
      toCoordinates: {
        x: 550,
        y: 200
      },
      color: "#8B4513",
      direction: "w",
      ticksToMove: 4
    },
    {
      fromCoordinates: {
        x: 50,
        y: 100
      },
      toCoordinates: {
        x: 250,
        y: 150
      },
      color: "#8B4513",
      direction: "e",
      ticksToMove: 4
    }
  ],
  portalPairs: [
    {
      portalAColor: "blue",
      portalACoordinates: {
        x: 50,
        y: 550
      },
      portalBColor: "orange",
      portalBCoordinates: {
        x: 450,
        y: 250
      }
    }
  ],
  cars: [
    // First row
    {
      coordinates: {
        x: 100,
        y: 500
      },
      color: "red",
      direction: "w",
      ticksToMove: 6
    },
    {
      coordinates: {
        x: 300,
        y: 500
      },
      color: "red",
      direction: "w",
      ticksToMove: 6
    },
    {
      coordinates: {
        x: 500,
        y: 500
      },
      color: "red",
      direction: "w",
      ticksToMove: 6
    },

    // Second row
    {
      coordinates: {
        x: 100,
        y: 450
      },
      color: "Orange",
      direction: "e",
      ticksToMove: 6
    },
    {
      coordinates: {
        x: 300,
        y: 450
      },
      color: "Orange",
      direction: "e",
      ticksToMove: 6
    },
    {
      coordinates: {
        x: 500,
        y: 450
      },
      color: "Orange",
      direction: "e",
      ticksToMove: 6
    },

    // Third row
    {
      coordinates: {
        x: 100,
        y: 300
      },
      color: "aqua",
      direction: "e",
      ticksToMove: 6
    },

    // Fourth row
    {
      coordinates: {
        x: 100,
        y: 350
      },
      color: "yellow",
      direction: "w",
      ticksToMove: 2
    },
    {
      coordinates: {
        x: 300,
        y: 350
      },
      color: "yellow",
      direction: "w",
      ticksToMove: 2
    },
    {
      coordinates: {
        x: 500,
        y: 350
      },
      color: "yellow",
      direction: "w",
      ticksToMove: 2
    }
  ],
  flies: [
    {
      isAlive: true,
      aliveTicks: 0,
      maxAliveTicks: 30,
      deadTicks: 0,
      maxDeadTicks: 100,
      coordinates: {
        x: 100,
        y: 250
      },
      color: "white",
      pointsValue: 2,
      eaten: false
    }
  ],
  gameOver: false,
  targetAreas: [
    {
      coordinates: {
        x: 100,
        y: 50
      },
      unreachedColor: "cornflowerblue",
      reachedColor: "#62cd70",
      reached: false
    },
    {
      coordinates: {
        x: 300,
        y: 50
      },
      unreachedColor: "cornflowerblue",
      reachedColor: "#62cd70",
      reached: false
    },
    {
      coordinates: {
        x: 500,
        y: 50
      },
      unreachedColor: "cornflowerblue",
      reachedColor: "#62cd70",
      reached: false
    }
  ],
  score: 0,
  highScore: 0
};

// Classes representing each of the input events
class Tick {constructor(public readonly elapsed: number) {}} // Based on clock
class FrogMove {constructor(public readonly direction: Direction) {}} // From keyboard input
class Click {constructor() {}} // From mouse click

// Observables
const gameClock$ = interval(constants.tickInterval).pipe(
    map(
        (seconds: number) => new Tick(seconds)
    )
)

const clickAction$ = fromEvent<MouseEvent>(document, 'mouseup').pipe(
    map(
        (_): Click => new Click()
    )
);

const movementAction$ = fromEvent<KeyboardEvent>(document, 'keydown').pipe(
    filter( // Filter out repeated keys
        ({repeat}): boolean =>
            !repeat
    ),
    map( // Unwrap key from event
        ({key}): string =>
            key
    ),
    map( // Turn single letter keys to lowercase (In case user has capslock on)
        (key): string =>
            key.length === 1 ? key.toLowerCase() : key
    ),
    filter( // Filter out keys that aren't valid movements
        (key): boolean =>
            ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'w', 'a', 's', 'd'].includes(key) // WASD and arrow keys are valid
    ),
    map( // Map keys to cardinal directions (North, South, East, West)
        (key): FrogMove =>
            ['ArrowUp', 'w'].includes(key) ? new FrogMove("n") :
                ['ArrowRight', 'd'].includes(key) ? new FrogMove("e") :
                    ['ArrowDown', 's'].includes(key) ? new FrogMove("s") :
                        new FrogMove("w")
    )
);

const bodyMove = (wraps: boolean) => (body: Body, direction: Direction) => (portalPairs: readonly PortalPair[]): Body => { // For moving a Body object based on a cardinal direction
  // Calculate the move that would happen, assuming the game border did not exist
  const proposedCoordinates = {
    x: body.coordinates.x + (direction === "e" ? constants.bodyWidth : direction === "w" ? -constants.bodyWidth : 0),
    y: body.coordinates.y + (direction === "n" ? -constants.bodyWidth : direction === "s" ? constants.bodyWidth : 0)
  };

  // Deal with the effects of the game border
  const borderAffectedCoordinates = {
    x: wraps
        ? (proposedCoordinates.x < 0 ? constants.canvasSize : proposedCoordinates.x > constants.canvasSize ? 0: proposedCoordinates.x)
        : (proposedCoordinates.x < 0 ? 0 : proposedCoordinates.x > constants.canvasSize ? constants.canvasSize : proposedCoordinates.x),
    y: wraps
        ? (proposedCoordinates.y < 0 ? constants.canvasSize : proposedCoordinates.y > constants.canvasSize ? 0: proposedCoordinates.y)
        : (proposedCoordinates.y < 0 ? 0 : proposedCoordinates.y > constants.canvasSize ? constants.canvasSize : proposedCoordinates.y)
  };

  // Deal with possibility of entering a portal
  const portalPairUnderBody = portalPairs.filter(
      (portalPair) => {
        const atPortalA = sameCoordinates(borderAffectedCoordinates)(portalPair.portalACoordinates)
        const atPortalB = sameCoordinates(borderAffectedCoordinates)(portalPair.portalBCoordinates)
        return atPortalA || atPortalB
      }
  )[0];

  const possiblePortalExit = portalPairUnderBody !== undefined && borderAffectedCoordinates.x === portalPairUnderBody.portalACoordinates.x && borderAffectedCoordinates.y === portalPairUnderBody.portalACoordinates.y
              ? portalPairUnderBody.portalBCoordinates
              : portalPairUnderBody !== undefined && borderAffectedCoordinates.x === portalPairUnderBody.portalBCoordinates.x && borderAffectedCoordinates.y === portalPairUnderBody.portalBCoordinates.y
              ? portalPairUnderBody.portalACoordinates
              : undefined

  const portalAffectedCoordinates = possiblePortalExit !== undefined ? possiblePortalExit : borderAffectedCoordinates

  return {
    ...body,
    coordinates: portalAffectedCoordinates
  };
};

const logMove = (log: Log): Log => { // For when a log in a river must shift
  const width = log.toCoordinates.x - log.fromCoordinates.x;
  const height = log.toCoordinates.y - log.fromCoordinates.y;

  // Calculate the move that would happen, assuming the game border did not exist
  const xMovement = log.direction === "e" ? constants.bodyWidth : log.direction === "w" ? -constants.bodyWidth : 0;
  const yMovement = log.direction === "n" ? -constants.bodyWidth : log.direction === "s" ? constants.bodyWidth : 0;

  const proposedFromCoordinates = {
    x: log.fromCoordinates.x + xMovement,
    y: log.fromCoordinates.y + yMovement
  }

  const proposedToCoordinates = {
    x: log.toCoordinates.x + xMovement,
    y: log.toCoordinates.y + yMovement
  }

  // Deal with the effects of the game border
  const determinedFromCoordinates = {
    x: proposedToCoordinates.x < 0 ? constants.canvasSize : proposedFromCoordinates.x > constants.canvasSize ? 0 - width : proposedFromCoordinates.x,
    y: proposedToCoordinates.y < 0 ? constants.canvasSize : proposedFromCoordinates.y > constants.canvasSize ? 0 - height : proposedFromCoordinates.y
  }

  const determinedToCoordinates = {
    x: proposedToCoordinates.x < 0 ? constants.canvasSize + width : proposedFromCoordinates.x > constants.canvasSize ? 0 : proposedToCoordinates.x,
    y: proposedToCoordinates.y < 0 ? constants.canvasSize + height : proposedFromCoordinates.y > constants.canvasSize ? 0 : proposedToCoordinates.y
  }

  return {
    ...log,
    fromCoordinates: determinedFromCoordinates,
    toCoordinates: determinedToCoordinates
  };
};

const frogIsOnLog = (frog: Body) => (log: Log): boolean => { // Determines whether the frog is on top of a log
  return (log.fromCoordinates.x <= frog.coordinates.x && log.toCoordinates.x > frog.coordinates.x) && (log.fromCoordinates.y <= frog.coordinates.y && log.toCoordinates.y > frog.coordinates.y)
}

const sameCoordinates = (coordinates1: Coordinates) => (coordinates2: Coordinates): boolean => // Determines whether two coordinates are identical
    coordinates1.x == coordinates2.x && coordinates1.y === coordinates2.y

const handleCollisions = (state: GameState): GameState => { // Created new state based on whether a collision is deemed to have occurred
  // Was there a car hit?
  const hitCar = state.cars
      .filter(
          (car) =>
              sameCoordinates(state.frog.coordinates)(car.coordinates)
      ).length !== 0;

  // Is the frog over water?
  const inWater = state.river === undefined
      ? false
      : (state.river.fromCoordinates.x <= state.frog.coordinates.x && state.river.toCoordinates.x > state.frog.coordinates.x)
        && (state.river.fromCoordinates.y <= state.frog.coordinates.y && state.river.toCoordinates.y > state.frog.coordinates.y);

  // Is the frog on a log?
  const onLog = state.logs.filter(
    (log) =>
      frogIsOnLog(state.frog)(log)
  ).length !== 0;

  // Is the frog on a target area?
  const onTargetArea = state.targetAreas.filter(
    (targetArea) =>
      sameCoordinates(state.frog.coordinates)(targetArea.coordinates)
  ).length !== 0;

  const drowned = inWater && !onLog && !onTargetArea; // Drowning definition

  return {
    ...state,
    gameOver: hitCar || drowned
  };
};

const handleTargetReached = (state: GameState): GameState => {
  // Set all targets under frog to be reached (i.e. they have been achieved)
  const updatedTargetAreas = state.targetAreas.map(
    (targetArea) => {
      return sameCoordinates(state.frog.coordinates)(targetArea.coordinates)
      ? {
        ...targetArea,
        reached: true
      }
      : targetArea
    }
  );

  // Are all targets now reached?
  const gameIsWon = state.targetAreas.filter(
    (targetArea) =>
      !targetArea.reached
  ).length === 0;

  const newGameOverState = gameIsWon ? true : state.gameOver;

  // Bring frog back to starting coordinates if target area is newly reached
  const frogIsOnATargetArea = state.targetAreas.filter(
      (targetArea) =>
          !targetArea.reached && sameCoordinates(state.frog.coordinates)(targetArea.coordinates)
  ).length > 0;

  const newFrogState = frogIsOnATargetArea
      ? {
        ...state.frog,
        coordinates: constants.frogStartCoordinates
      }
      : state.frog;

  // Update score and high score
  const newScore = frogIsOnATargetArea
      ? state.score + 1
      : state.score

  const newHighScore = state.score > state.highScore ? state.score : state.highScore;

  return {
    ...state,
    targetAreas: updatedTargetAreas,
    gameOver: newGameOverState,
    frog: newFrogState,
    score: newScore,
    highScore: newHighScore
  };
};

function updateView(state: GameState): void { // Only impure function, updates HTML/SVG based on game state
  const svg = document.querySelector("#svgCanvas") as SVGElement & HTMLElement;
  svg.replaceChildren("")

  if (state.gameOver) {
    const gameOverMessage = document.createElementNS(svg.namespaceURI, "text")!;
    gameOverMessage.setAttribute("x", String(80));
    gameOverMessage.setAttribute("y", String(80));
    gameOverMessage.setAttribute("style", "font-size: 5rem;");
    gameOverMessage.setAttribute("fill", "white");
    gameOverMessage.textContent = `Game Over`;
    svg.appendChild(gameOverMessage);

    const scoreMessage = document.createElementNS(svg.namespaceURI, "text")!;
    scoreMessage.textContent = `Finished with score: ${state.score}`;
    scoreMessage.setAttribute("x", String(20));
    scoreMessage.setAttribute("y", String(170));
    scoreMessage.setAttribute("style", "font-size: 2rem;");
    scoreMessage.setAttribute("fill", "white");
    svg.appendChild(scoreMessage);

    const highScoreMessage = document.createElementNS(svg.namespaceURI, "text")!;
    highScoreMessage.textContent = `High score: ${state.highScore}`;
    highScoreMessage.setAttribute("x", String(20));
    highScoreMessage.setAttribute("y", String(210));
    highScoreMessage.setAttribute("style", "font-size: 1.5rem;");
    highScoreMessage.setAttribute("fill", "white");
    svg.appendChild(highScoreMessage);

    const continueMessage = document.createElementNS(svg.namespaceURI, "text")!;
    continueMessage.textContent = `Click anywhere to play again.`;
    continueMessage.setAttribute("x", String(80));
    continueMessage.setAttribute("y", String(350));
    continueMessage.setAttribute("style", "font-size: 2rem;");
    continueMessage.setAttribute("fill", "white");
    svg.appendChild(continueMessage);

    return
  }

  // Update River
  if (state.river) {
    const width = state.river.toCoordinates.x - state.river.fromCoordinates.x;
    const height = state.river.toCoordinates.y - state.river.fromCoordinates.y;

    const newRiver = document.createElementNS(svg.namespaceURI, "rect");
    newRiver.setAttribute("width", String(width));
    newRiver.setAttribute("height", String(height));
    newRiver.setAttribute("style", `fill: ${state.river.color};`);
    newRiver.setAttribute("x", String(state.river.fromCoordinates.x));
    newRiver.setAttribute("y", String(state.river.fromCoordinates.y));
    svg.appendChild(newRiver)
  }

  // Update target areas
  state.targetAreas.map(
    (targetArea) => {
      const newTargetArea = document.createElementNS(svg.namespaceURI, "rect");
      newTargetArea.setAttribute("width", String(constants.bodyWidth));
      newTargetArea.setAttribute("height", String(constants.bodyWidth));
      newTargetArea.setAttribute("style", `fill: ${targetArea.reached ? targetArea.reachedColor : targetArea.unreachedColor};`);
      newTargetArea.setAttribute("x", String(targetArea.coordinates.x));
      newTargetArea.setAttribute("y", String(targetArea.coordinates.y));
      svg.appendChild(newTargetArea)
    }
  )

  // Update logs
  state.logs.map(
    (log) => {
      const width = log.toCoordinates.x - log.fromCoordinates.x;
      const height = log.toCoordinates.y - log.fromCoordinates.y;

      const newLog = document.createElementNS(svg.namespaceURI, "rect");
      newLog.setAttribute("width", String(width));
      newLog.setAttribute("height", String(height));
      newLog.setAttribute("style", `fill: ${log.color};`);
      newLog.setAttribute("x", String(log.fromCoordinates.x));
      newLog.setAttribute("y", String(log.fromCoordinates.y));
      svg.appendChild(newLog)
    }
  )

  // Update Portals
  state.portalPairs.map(
    (portalPair) => {
      const newPortalA = document.createElementNS(svg.namespaceURI, "circle");
      newPortalA.setAttribute("r", String(constants.bodyWidth/2));
      newPortalA.setAttribute("style", `fill: ${portalPair.portalAColor};`);
      newPortalA.setAttribute("cx", String(portalPair.portalACoordinates.x + constants.bodyWidth/2));
      newPortalA.setAttribute("cy", String(portalPair.portalACoordinates.y + constants.bodyWidth/2));
      svg.appendChild(newPortalA)

      const newPortalB = document.createElementNS(svg.namespaceURI, "circle");
      newPortalB.setAttribute("r", String(constants.bodyWidth/2));
      newPortalB.setAttribute("style", `fill: ${portalPair.portalBColor};`);
      newPortalB.setAttribute("cx", String(portalPair.portalBCoordinates.x + constants.bodyWidth/2));
      newPortalB.setAttribute("cy", String(portalPair.portalBCoordinates.y + constants.bodyWidth/2));
      svg.appendChild(newPortalB)
    }
  )

  state.flies.filter(
      (fly) =>
          fly.isAlive
  ).map(
    (fly) => {
      const newFly = document.createElementNS(svg.namespaceURI, "rect");
      const margin = 0.3*constants.bodyWidth;

      newFly.setAttribute("width", String(constants.bodyWidth -2*margin));
      newFly.setAttribute("height", String(constants.bodyWidth -2*margin));
      newFly.setAttribute("style", `fill: ${fly.color};`);
      newFly.setAttribute("x", String(fly.coordinates.x + margin));
      newFly.setAttribute("y", String(fly.coordinates.y + margin));
      svg.appendChild(newFly)
    }
  )

  // Update cars
  state.cars.map(
    (car) => {
      const newCar = document.createElementNS(svg.namespaceURI, "rect");
      newCar.setAttribute("width", String(constants.bodyWidth));
      newCar.setAttribute("height", String(constants.bodyWidth));
      newCar.setAttribute("style", `fill: ${car.color};`);
      newCar.setAttribute("x", String(car.coordinates.x));
      newCar.setAttribute("y", String(car.coordinates.y));
      svg.appendChild(newCar)
    }
  )

  // Update frog
  const newFrog = document.createElementNS(svg.namespaceURI, "rect");
  newFrog.setAttribute("width", String(constants.bodyWidth));
  newFrog.setAttribute("height", String(constants.bodyWidth));
  newFrog.setAttribute("style", `fill: ${state.frog.color};`);
  newFrog.setAttribute("x", String(state.frog.coordinates.x));
  newFrog.setAttribute("y", String(state.frog.coordinates.y));
  svg.appendChild(newFrog)

  // Update scoreboard
  // @ts-ignore
  document.getElementById("score").innerText = String(state.score)
  // @ts-ignore
  document.getElementById("high-score").innerText = String(state.highScore)
}

const tickedEvent = (state: GameState) => (tick: Tick): GameState => { // Gets new game state due to game tick
  const logUnderFrog = state.logs.filter(
      (log) =>
          frogIsOnLog(state.frog)(log)
  )[0];

  const frogAtFly = state.flies.filter(
      (fly) =>
        sameCoordinates(state.frog.coordinates)(fly.coordinates)
  )[0];

  return {
    ...state,
    cars: state.cars.map(
      (car) => {
        return tick.elapsed % car.ticksToMove === 0 // Uses car's speed
          ? bodyMove(true)(car, car.direction)(state.portalPairs) // Move car
          : car
      }
    ),
    logs: state.logs.map(
      (log) => {
        return tick.elapsed % log.ticksToMove === 0 // Uses log's speed
          ? logMove(log) // Moves log
          : log
      }
    ),
    frog: logUnderFrog !== undefined && (tick.elapsed % logUnderFrog.ticksToMove == 0) // If the log is on a frog, and that log is going to move
      ? bodyMove(false)(state.frog, logUnderFrog.direction)(state.portalPairs) // Move the frog with it
      : state.frog,
    flies: state.flies.map(
      (fly) => {
        return fly.eaten // Eaten flies don't change ever again
          ? fly
          : {
          ...fly,
          // Modify counter for aliveTicks or deadTicks until it reaches its max value, and then switch between alive/dead
          isAlive: sameCoordinates(state.frog.coordinates)(fly.coordinates) ? false : (fly.aliveTicks === fly.maxAliveTicks || fly.deadTicks === fly.maxDeadTicks ? !fly.isAlive : fly.isAlive),
          aliveTicks: fly.isAlive && fly.aliveTicks < fly.maxAliveTicks ? fly.aliveTicks + 1 : 0,
          deadTicks: !fly.isAlive && fly.deadTicks < fly.maxDeadTicks ? fly.deadTicks + 1 : 0,
          eaten: sameCoordinates(state.frog.coordinates)(fly.coordinates) && fly.isAlive ? true : fly.eaten
        }
      }
    ),
    score: frogAtFly !== undefined && frogAtFly.isAlive ? state.score + frogAtFly.pointsValue : state.score // Grant points for eating fly
  }
}

const frogMovedEvent = (state: GameState) => (frogMove: FrogMove): GameState => { // Movement of a frog
  return {
    ...state,
    frog: bodyMove(false)(state.frog, frogMove.direction)(state.portalPairs)
  }
}

const restartGameEvent = (state: GameState) => (initialState: GameState): GameState => { // Starts game over for a new play
  return state.gameOver
  ? {
    ...initialState,
    highScore: state.highScore // Keeps high score from previous play
  }
  : state;
};

const reduceState = (initialState: GameState) => (state: GameState, event: FrogMove|Tick|Click): GameState => { // Determines the new state of the game due to an event
  const eventAffectedState =
    event instanceof FrogMove ? frogMovedEvent(state)(event)
    : event instanceof Tick ? tickedEvent(state)(event)
    : restartGameEvent(state)(initialState); // Click event

  return eventAffectedState.gameOver
  ? eventAffectedState
  : handleTargetReached(handleCollisions(eventAffectedState));
};

function main() {

  // Main observable subscription
  merge(
      gameClock$,
      movementAction$,
      clickAction$
  ).pipe(
      scan(reduceState(initialState), initialState)
  ).subscribe(updateView);
}

if (typeof window !== "undefined") {
  window.onload = () => {
    main();
  };
}
