import { Module } from "@nestjs/common";
import { StorageController } from "./storage/controller";
import { StorageModule } from "./storage/module";

@Module({
    imports: [StorageModule],
})
export class AppModule {}
