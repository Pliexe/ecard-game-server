import { createServer, Server } from 'http';
import io from 'socket.io';
import express from 'express';

export class SocketServer
{
    public static readonly PORT: number = parseInt(process.env.PORT) || 3000;
    private httpConnection: Server;
    public socketHandler: SocketIO.Server;
    public app = express();

    constructor()
    {
        this.httpConnection = createServer(this.app);
        this.socketHandler = io(this.httpConnection);
        this.listen();
    }

    public listen(): void
    {
        this.httpConnection.listen(SocketServer.PORT, () =>
        {
            console.log("Server listening at port %d", SocketServer.PORT);
        });
    }
}