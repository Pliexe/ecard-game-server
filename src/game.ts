import { shuffle } from "./utils";
import { Round } from "./round";

const cards = [
    ["citizen", "citizen", "citizen", "citizen", "emperor"],
    ["citizen", "citizen", "citizen", "citizen", "slave"]
];

type gameTypes = "ranked" | "normal" | "custom";

export class Game {
    private startTime: number = Date.now();

    private p1Socket: SocketIO.Socket;
    private p2Socket: SocketIO.Socket;

    private p1ID: string;
    private p2ID: string;

    private oneDone: boolean = false;
    private playingThisRound: number;

    private gameEndCallback: (p1id, p2id, info: { time: number, p1s: number, p2s: number, winer: string, type: "ranked" | "normal" | "custom" }) => void;

    private gameType: gameTypes;

    // Scores

    private p1Score: number = 0;
    private p2Score: number = 0;

    // Rounds

    private round: number = 2;
    private maxRounds: number = 12;
    private switchSideBetween: number = 3;

    constructor(p1: { socket: SocketIO.Socket, id: string }, p2: { socket: SocketIO.Socket, id: string }, type: gameTypes, gameEndFunc: (p1id, p2id, info: { time: number, p1s: number, p2s: number, winer: string, type: "ranked" | "normal" | "custom" }) => void) {
        this.p1Socket = p1.socket;
        this.p2Socket = p2.socket;

        this.p1ID = p1.id;
        this.p2ID = p2.id;

        this.gameEndCallback = gameEndFunc;
        this.gameType = type;

        p1.socket.emit('oppomentConnected');
        p2.socket.emit('oppomentConnected');

        this.initGame();
    }

    private initGame() {
        this.playingThisRound = Math.round(Math.random());

        const p1Cards = shuffle(cards[this.playingThisRound]).slice();
        const p2Cards = shuffle(cards[1 - this.playingThisRound]).slice();

        new Round(this.p1Socket, p1Cards, this.p2Socket, p2Cards, this);

        this.p1Socket.emit("gameStart", { yourCards: p1Cards, enemyCards: p2Cards });

        this.p2Socket.emit("gameStart", { yourCards: p2Cards, enemyCards: p1Cards });

        console.log("ROUND >>> "+ this.round);
    }

    public outcome(p1Win: boolean) {
        console.log("ROUND 1 >>> "+ this.round);
        this.round++;
        console.log("ROUND 2 >>> "+ this.round);

        if (p1Win)
            this.p1Score++;
        else
            this.p2Score++;

        this.p1Socket.emit("updateScore", { yourScore: this.p1Score, enemyScore: this.p2Score, round: this.round });
        this.p2Socket.emit("updateScore", { yourScore: this.p2Score, enemyScore: this.p1Score, round: this.round });

        console.log(`${this.round} > ${this.maxRounds}: ${this.round > this.maxRounds}`);
        if (this.round <= this.maxRounds) {
            const p1Cards = shuffle(cards[this.playingThisRound]).slice();
            const p2Cards = shuffle(cards[1 - this.playingThisRound]).slice();

            new Round(this.p1Socket, p1Cards, this.p2Socket, p2Cards, this);

            this.p1Socket.emit("nextRound", { yourCards: p1Cards, enemyCards: p2Cards });

            this.p2Socket.emit("nextRound", { yourCards: p2Cards, enemyCards: p1Cards });

            for (let i = 0; i <= this.round; i = i + this.switchSideBetween) {
                if (i == this.round) this.playingThisRound = 1 - this.playingThisRound;
            }
        }
        else
        {
            if(this.p1Score == this.p2Score)
            {
                this.p1Socket.emit("draw");
                this.p2Socket.emit("draw");
                this.gameEndCallback(this.p1ID, this.p2ID, { type: this.gameType, time: Date.now() - this.startTime, p1s: this.p1Score, p2s: this.p2Score, winer: "draw" })
            } else if(this.p1Score > this.p2Score)
            {
                this.p1Socket.emit("win");
                this.p2Socket.emit("lose");
                this.gameEndCallback(this.p1ID, this.p2ID, { type: this.gameType, time: Date.now() - this.startTime, p1s: this.p1Score, p2s: this.p2Score, winer: "p1" });
            } else {
                this.p1Socket.emit("lose");
                this.p2Socket.emit("win");
                this.gameEndCallback(this.p1ID, this.p2ID, { type: this.gameType, time: Date.now() - this.startTime, p1s: this.p1Score, p2s: this.p2Score, winer: "p2" });
            }
        }
    }
}