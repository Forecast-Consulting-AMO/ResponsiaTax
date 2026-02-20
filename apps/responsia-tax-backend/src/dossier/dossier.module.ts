import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Dossier } from './entities/dossier.entity';
import { DossierService } from './dossier.service';
import { DossierController } from './dossier.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Dossier])],
  controllers: [DossierController],
  providers: [DossierService],
  exports: [DossierService],
})
export class DossierModule {}
