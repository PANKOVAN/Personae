import { Global, Module } from "@nestjs/common";
import { StorageService } from "./service";

@Global()
@Module({
    providers: [StorageService],
    exports: [StorageService],
})
export class StorageModule {}
