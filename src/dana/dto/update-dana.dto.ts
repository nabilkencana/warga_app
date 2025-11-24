import { PartialType } from '@nestjs/swagger';
import { CreateDanaDto } from './create-dana.dto';

export class UpdateDanaDto extends PartialType(CreateDanaDto) {}
