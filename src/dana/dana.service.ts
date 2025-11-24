import { Injectable } from '@nestjs/common';
import { CreateDanaDto } from './dto/create-dana.dto';
import { UpdateDanaDto } from './dto/update-dana.dto';

@Injectable()
export class DanaService {
  create(createDanaDto: CreateDanaDto) {
    return 'This action adds a new dana';
  }

  findAll() {
    return `This action returns all dana`;
  }

  findOne(id: number) {
    return `This action returns a #${id} dana`;
  }

  update(id: number, updateDanaDto: UpdateDanaDto) {
    return `This action updates a #${id} dana`;
  }

  remove(id: number) {
    return `This action removes a #${id} dana`;
  }
}
