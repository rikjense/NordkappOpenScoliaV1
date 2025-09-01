import { Router } from "express";
import { sseHub } from "../core/sseHub";

export const eventsRoute = Router();

// Optional filter: /events/stream?boardId=board-2
eventsRoute.get("/events/stream", (req, res) => sseHub.connect(req, res));
