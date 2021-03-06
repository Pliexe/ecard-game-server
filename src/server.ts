import { SocketServer } from "./SocketIO";
import { Game } from "./game";
import { type } from "os";
import path from 'path';
import ms from "ms";
import shortid from 'shortid';

const socketServer = new SocketServer();
const app = socketServer.app;
const io: SocketIO.Server = socketServer.socketHandler;

// Load view Engine

app.set('views', path.join(__dirname, '../views'));
app.set('view engine', 'pug');

// app.use(express.static('public'));

app.get('/', function(request, response) {
//   response.send(`Game server uptime of: ${process.uptime()} seconds and total of ${0} games played science uptime`);
    response.render('index.pug', { 
        uptime: ms(process.uptime() * 1000, { long: true }),
        games: gamesPlayed,
        currentGames: activeGames.size == 1 ? `${activeGames.size} game is` : `${activeGames.size} games are`,
        ramUsage: process.memoryUsage().rss >= 1000000000 ? `${Math.round((process.memoryUsage().rss / 1000000000)).toFixed(2)}GB` : `${Math.round((process.memoryUsage().rss / 1000000)).toFixed(2)}MB` 
    });
});

const version = "0.0.1";

const delay = ms => new Promise(res => setTimeout(res, ms));

let main_server: SocketIO.Socket;
let gamesPlayed: number = 0;
let gameQueue: { playerid1: string, player1Socket: SocketIO.Socket, playerid2: string, player2Socket: SocketIO.Socket, gameType: "normal" | "ranked" | "custom" }[] = [
    // {
    //     playerid1: "1", player1Socket: undefined,
    //     playerid2: "2", player2Socket: undefined,
    // },
];

let activeGames: Map<string, Game> = new Map();

io.on('connect', (socket) => {
    console.log("CONNECTED");

    let usrType: string = "";
    let inGame: boolean = false;
    let id: string = "";

    let tmn = setTimeout(() => {
        socket.disconnect();
        console.log("FORCE DISC TIMEOUT");
    }, 5000);

    socket.on('auth', async ({ type, auth, gVersion }: { type: string, auth: string, gVersion: string }) => {
        clearTimeout(tmn);

        switch (type) {
            case "server":
                if (!!main_server)
                    if (main_server.connected) {
                        socket.emit("authResult", { result: false, reason: "There is already a main server connected." });
                        return socket.disconnect();
                    }
                if (process.env.AUTH != auth) {
                    socket.emit("authResult", { result: false, reason: "Invalid auth token." });
                    return socket.disconnect();
                }

                console.log("HAHAH");

                main_server = socket;
                usrType = "server";
                break;
            case "game":
                if (!main_server) {
                    socket.emit("authResult", { result: false, reason: "Game server not connected to main server" });
                    return socket.disconnect();
                }
                if (!main_server.connected) {
                    socket.emit("authResult", { result: false, reason: "Main server disconnected from game server." });
                    return socket.disconnect();
                }

                if (version != gVersion) {
                    console.log("Outdated");
                    socket.emit("authResult", { result: false, reason: 'You have outdated game version, please update it.' });
                    socket.disconnect();
                    return;
                }
                if (!gameQueue.some(x => x.playerid1 == auth || x.playerid2 == auth)) {
                    console.log("CURRENT GAMES > ");
                    console.log(gameQueue);
                    socket.emit('authResult', { result: false, reason: 'Game is no longer avaible.' });
                    socket.disconnect();
                    return;
                }

                let gameIndex = gameQueue.findIndex(x => x.playerid1 == auth || x.playerid2 == auth);
                let game = gameQueue[gameIndex];

                if (game.playerid1 == auth) {
                    console.log("asigning soc1");
                    if (game.player1Socket != undefined) {
                        socket.emit('authResult', { result: false, reason: 'Already connected to this server.' });
                        socket.disconnect();
                        return;
                    }

                    game.player1Socket = socket;
                } else {
                    console.log("asigning soc2");
                    if (game.player2Socket != undefined) {
                        socket.emit('authResult', { result: false, reason: 'Already connected to this server.' });
                        socket.disconnect();
                        return;
                    }

                    game.player2Socket = socket;
                }

                if (game.player1Socket != undefined && game.player2Socket != undefined)
                    if (game.player1Socket.connected && game.player2Socket.connected) {
                        console.log("p1 id: "+game.playerid1 +", Pushing back dev testing stuff: "+(game.playerid1 == "1" && game.playerid2 == "2"));

                        let gameid = shortid();

                        activeGames.set(gameid, new Game({ socket: game.player1Socket, id: game.playerid1 }, { socket: game.player2Socket, id: game.playerid2 }, game.gameType, gameid, gameEnd));
                        
                        gameQueue.splice(gameIndex, 1);
                    }

                usrType = "game";
                inGame = true;
                id = auth;

                return socket.emit("authResult", { result: true, reason: '' });
            default:
                socket.emit("authResult", { result: false, reason: 'Unknown Error' });
                return socket.disconnect();
        }
    });

    socket.on("queueGame", (p1: string, p2: string, gameType: "normal" | "ranked" | "custom", callback: (result: boolean) => void) => {
        console.log(usrType);
        console.log(usrType != "server");
        if (usrType != "server") return callback(false);

        gameQueue.push({ playerid1: p1, player1Socket: undefined, playerid2: p2, player2Socket: undefined, gameType: gameType });
        callback(true);
        console.log(`${p1} ${p2}`);
    });

    socket.on('disconnect', () => {
        if (usrType === "game" && inGame)
            if (gameQueue.some(x => x.playerid1 == id || x.playerid2 == id)) {
                let index = gameQueue.findIndex(x => x.playerid1 == id || x.playerid2 == id);
                if (gameQueue[index].player1Socket != undefined) gameQueue[index].player1Socket.emit('oppomentDisc');
                if (gameQueue[index].player2Socket != undefined) gameQueue[index].player2Socket.emit('oppomentDisc');
                main_server.emit('loadFail', gameQueue[index].playerid1, gameQueue[index].playerid2);
                gameQueue.splice(index, 1);
            }

    });
});

function gameEnd(gameid: string, p1id, p2id, info: { time: number, p1s: number, p2s: number, winer: string, type: "ranked" | "normal" | "custom" }) {
    if(activeGames.has(gameid)) activeGames.delete(gameid);
    gamesPlayed++;
    main_server.emit('gameResult', p1id, p2id, { type: type, time: info.time, p1s: info.p1s, p2s: info.p2s, winer: info.winer });
}

function ingameConnectionHandler()
{

}