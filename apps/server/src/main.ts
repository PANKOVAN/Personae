import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { AppModule } from "./app.module";

async function bootstrap() {
    const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
        logger: ["error", "warn", "log"],
    });
    /* @fastify/cors по умолчанию: methods = GET,HEAD,POST — без DELETE preflight не разрешает удаление. */
    app.enableCors({
        origin: true,
        methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    });
    app.use((request, reply, next) => {
        console.log(`[${request.method}] ${request.url}`);
        next();
    });
    const port = Number(process.env.PORT) || 3000;
    await app.listen(port, "0.0.0.0");
    console.log(`Personae API http://127.0.0.1:${port}`);
}

void bootstrap();
