import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { RoundService } from './round.service';
import { CreateRoundDto } from './dto/create-round.dto';
import { UpdateRoundDto } from './dto/update-round.dto';

@ApiTags('rounds')
@Controller({ version: '1' })
export class RoundController {
  constructor(private readonly roundService: RoundService) {}

  @Post('dossiers/:dossierId/rounds')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new round for a dossier' })
  @ApiResponse({ status: 201, description: 'Round created' })
  create(
    @Param('dossierId', ParseUUIDPipe) dossierId: string,
    @Body() dto: CreateRoundDto,
  ) {
    return this.roundService.create(dossierId, dto);
  }

  @Get('dossiers/:dossierId/rounds')
  @ApiOperation({ summary: 'List all rounds for a dossier' })
  @ApiResponse({ status: 200, description: 'List of rounds' })
  findAll(@Param('dossierId', ParseUUIDPipe) dossierId: string) {
    return this.roundService.findAllByDossier(dossierId);
  }

  @Get('rounds/:id')
  @ApiOperation({ summary: 'Get a round by ID (with questions)' })
  @ApiResponse({ status: 200, description: 'Round found' })
  @ApiResponse({ status: 404, description: 'Round not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.roundService.findOne(id);
  }

  @Patch('rounds/:id')
  @ApiOperation({ summary: 'Update a round' })
  @ApiResponse({ status: 200, description: 'Round updated' })
  @ApiResponse({ status: 404, description: 'Round not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoundDto,
  ) {
    return this.roundService.update(id, dto);
  }
}
