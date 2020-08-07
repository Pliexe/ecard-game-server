import { Game } from "./game";

const delay = ms => new Promise(res => setTimeout(res, ms));

export class Round {
    private p1Socket: SocketIO.Socket;
    private p1Cards: string[];

    private p2Socket: SocketIO.Socket;
    private p2Cards: string[];

    private oneDone: boolean = false;

    private callback: Game;

    /**
     * 
     * @param p1Socket 
     * @param p1Cards 
     * @param p2Socket 
     * @param p2Cards 
     * @param callback Returns if player 1 won
     */

    constructor(p1Socket: SocketIO.Socket, p1Cards: string[], p2Socket: SocketIO.Socket, p2Cards: string[], callback: Game)
    {
        this.p1Socket = p1Socket;
        this.p1Cards = p1Cards;

        this.p2Socket = p2Socket;
        this.p2Cards = p2Cards;

        this.startRoundRound();

        this.callback = callback;
    }

    startRoundRound()
    {
        let lastChoice: number;

        this.p1Socket.once('placeCard', ({ card, index }) => {
            if(isNaN(index)) return console.log("p1 index Not a Number");
            let cardIndex = parseInt(index);

            if(this.p1Cards.length <= cardIndex) return console.log("Wrong index. p1");

            this.p2Socket.emit('enemyPlaceCard', {index: cardIndex});

            console.log(`p1 ${this.oneDone}`);

            if(this.oneDone) return this.calculateOutcome(index, lastChoice);
            lastChoice = index;
            this.oneDone = true;
        });

        this.p2Socket.once('placeCard', ({ card, index }) => {
            if(isNaN(index)) return console.log("p2 index Not a Number");
            let cardIndex = parseInt(index);

            if(this.p2Cards.length <= cardIndex) return console.log("Wrong index. p2");

            this.p1Socket.emit('enemyPlaceCard', {index: cardIndex});

            console.log(`p2 ${this.oneDone}`);

            if(this.oneDone) return this.calculateOutcome(lastChoice, index);
            lastChoice = index;
            this.oneDone = true;
        });
    }

    async calculateOutcome(p1Choosen: number, p2Choosen: number)
    {
        await delay(3000);
        console.log(`p1 choice: ${this.p1Cards[p1Choosen]} | p2 choice: ${this.p2Cards[p2Choosen]}`);

        switch(this.p1Cards[p1Choosen])
        {
            case "citizen":
                
                switch(this.p2Cards[p2Choosen])
                {
                    case "citizen":
                        this.oneDone = false;
                        this.p1Cards.splice(p1Choosen, 1);
                        this.p2Cards.splice(p2Choosen, 1);
                        this.startRoundRound();
                        this.p1Socket.emit("ContinueRound");
                        this.p2Socket.emit("ContinueRound");
                        break;
                    case "slave":
                        this.callback.outcome(true);
                        break;
                    case "emperor":
                        this.callback.outcome(false);
                }

                break;
            case "emperor":

                switch(this.p2Cards[p2Choosen])
                {
                    case "citizen":
                        this.callback.outcome(true);
                        break;
                    case "slave":
                        this.callback.outcome(false);
                        break;
                }

                break;
            case "slave":

                switch(this.p2Cards[p2Choosen])
                {
                    case "citizen":
                        this.callback.outcome(false);
                        break;
                    case "emperor":
                        this.callback.outcome(true);
                        break;
                }

                break;
        }
    }
}