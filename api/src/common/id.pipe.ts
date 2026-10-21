import { BadRequestException, type PipeTransform } from '@nestjs/common'

export class IdPipe implements PipeTransform<string, number> {
  transform(value: string): number {
    const id = Number(value)
    if (!Number.isInteger(id) || id <= 0) throw new BadRequestException('id must be a positive integer')
    return id
  }
}
