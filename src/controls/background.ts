import { Camera } from "../camera";
import { Canvas2D } from "../canvas";
import { Control } from "./control";
import { DrawableControl } from "./interfaces/drawable";

export class Background extends Control implements DrawableControl {

    // UE5 canvas: a mid-dark neutral field ruled by grid lines *darker* than
    // the field, so the grid reads as grooves and nodes stay the brightest
    // surfaces on screen.
    private static readonly BASE_COLOR = "#262626";
    private static readonly MINOR_GRID_COLOR = "#212121";   // ~13% black over the field
    private static readonly MAJOR_GRID_COLOR = "#1b1b1b";   // ~30% black, every 8th line
    private static readonly AXIS_COLOR = "#0a0a0a";         // near-black origin axes
    private static readonly SMALL_GRID = 16;
    private static readonly LARGE_GRID = 128;

    camera: Camera;

    constructor(camera: Camera) {
        super(0, 0, -1000);
        this.camera = camera;
    }

    draw(canvas: Canvas2D) {
        const scale = this.camera.scale;
        const pan = this.camera.position;

        const worldLeft = -pan.x / scale;
        const worldTop = -pan.y / scale;
        const worldWidth = canvas.width / scale;
        const worldHeight = canvas.height / scale;

        canvas.fillStyle(Background.BASE_COLOR)
            .fillRect(worldLeft - 4 / scale, worldTop - 4 / scale, worldWidth + 8 / scale, worldHeight + 8 / scale);

        const ctx = canvas.getContext();

        const minorAlpha = scale < 0.5 ? 0 : Math.min(1, (scale - 0.3) / 0.6);
        if (minorAlpha > 0.02) {
            ctx.save();
            ctx.globalAlpha = minorAlpha;
            ctx.strokeStyle = Background.MINOR_GRID_COLOR;
            ctx.lineWidth = 1 / scale;
            ctx.beginPath();
            const minorX0 = Math.floor(worldLeft / Background.SMALL_GRID) * Background.SMALL_GRID;
            const minorY0 = Math.floor(worldTop / Background.SMALL_GRID) * Background.SMALL_GRID;
            for (let x = minorX0; x <= worldLeft + worldWidth; x += Background.SMALL_GRID) {
                ctx.moveTo(x, worldTop);
                ctx.lineTo(x, worldTop + worldHeight);
            }
            for (let y = minorY0; y <= worldTop + worldHeight; y += Background.SMALL_GRID) {
                ctx.moveTo(worldLeft, y);
                ctx.lineTo(worldLeft + worldWidth, y);
            }
            ctx.stroke();
            ctx.restore();
        }

        ctx.save();
        ctx.strokeStyle = Background.MAJOR_GRID_COLOR;
        ctx.lineWidth = 1 / scale;
        ctx.beginPath();
        const majorX0 = Math.floor(worldLeft / Background.LARGE_GRID) * Background.LARGE_GRID;
        const majorY0 = Math.floor(worldTop / Background.LARGE_GRID) * Background.LARGE_GRID;
        for (let x = majorX0; x <= worldLeft + worldWidth; x += Background.LARGE_GRID) {
            ctx.moveTo(x, worldTop);
            ctx.lineTo(x, worldTop + worldHeight);
        }
        for (let y = majorY0; y <= worldTop + worldHeight; y += Background.LARGE_GRID) {
            ctx.moveTo(worldLeft, y);
            ctx.lineTo(worldLeft + worldWidth, y);
        }
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = Background.AXIS_COLOR;
        ctx.lineWidth = 1.5 / scale;
        ctx.beginPath();
        if (worldTop <= 0 && worldTop + worldHeight >= 0) {
            ctx.moveTo(worldLeft, 0);
            ctx.lineTo(worldLeft + worldWidth, 0);
        }
        if (worldLeft <= 0 && worldLeft + worldWidth >= 0) {
            ctx.moveTo(0, worldTop);
            ctx.lineTo(0, worldTop + worldHeight);
        }
        ctx.stroke();
        ctx.restore();
    }
}
