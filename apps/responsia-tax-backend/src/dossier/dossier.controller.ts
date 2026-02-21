import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { DossierService } from './dossier.service';
import { CreateDossierDto } from './dto/create-dossier.dto';
import { UpdateDossierDto } from './dto/update-dossier.dto';
import { DossierStatus } from './entities/dossier.entity';

@ApiTags('dossiers')
@Controller({ path: 'dossiers', version: '1' })
export class DossierController {
  constructor(private readonly dossierService: DossierService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new dossier' })
  @ApiResponse({ status: 201, description: 'Dossier created successfully' })
  create(@Body() dto: CreateDossierDto) {
    return this.dossierService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List dossiers (paginated)' })
  @ApiQuery({ name: 'status', enum: DossierStatus, required: false })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 50, max: 100)' })
  @ApiResponse({ status: 200, description: 'Paginated list of dossiers' })
  findAll(
    @Query('status') status?: DossierStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.dossierService.findAll(
      status,
      page ? parseInt(page, 10) : undefined,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a dossier by ID (with rounds and documents)' })
  @ApiResponse({ status: 200, description: 'Dossier found' })
  @ApiResponse({ status: 404, description: 'Dossier not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.dossierService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a dossier' })
  @ApiResponse({ status: 200, description: 'Dossier updated' })
  @ApiResponse({ status: 404, description: 'Dossier not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDossierDto,
  ) {
    return this.dossierService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a dossier' })
  @ApiResponse({ status: 204, description: 'Dossier deleted' })
  @ApiResponse({ status: 404, description: 'Dossier not found' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.dossierService.remove(id);
  }
}
