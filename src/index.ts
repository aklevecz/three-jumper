import "./styles.scss";
import { Game } from "./game";

const body = document.body;
body.style.margin = "0px";

const startButtonContainer = document.createElement("div");
const startButton = document.createElement("button");
startButton.id = "start-button";
startButton.innerText = "START";
startButtonContainer.appendChild(startButton);
body.appendChild(startButtonContainer);

const scoreBoard = document.createElement("div");
scoreBoard.id = "score-board";
body.appendChild(scoreBoard);

const pauseButton = document.createElement("button");
pauseButton.id = "pause-button";
pauseButton.innerText = "PAUSE";
body.appendChild(pauseButton);

new Game();
