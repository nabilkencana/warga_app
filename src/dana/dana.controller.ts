import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { DanaService } from './dana.service';
import { CreateDanaDto } from './dto/create-dana.dto';
import { UpdateDanaDto } from './dto/update-dana.dto';

@Controller('dana')
export class DanaController {
  constructor(private readonly danaService: DanaService) {}

  @Post()
  create(@Body() createDanaDto: CreateDanaDto) {
    return this.danaService.create(createDanaDto);
  }

  @Get()
  findAll() {
    return this.danaService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.danaService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDanaDto: UpdateDanaDto) {
    return this.danaService.update(+id, updateDanaDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.danaService.remove(+id);
  }
}
