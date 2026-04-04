import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { AppModule } from "./app.module";

async function bootstrap() {
    const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
        logger: ["error", "warn", "log"],
    });
    app.enableCors({ origin: true });
    const port = Number(process.env.PORT) || 3000;
    await app.listen(port, "0.0.0.0");
    console.log(`Personae API http://127.0.0.1:${port}`);
}

void bootstrap();
