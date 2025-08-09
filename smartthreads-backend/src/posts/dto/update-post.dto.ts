import {
  IsString,
  IsOptional,
  IsArray,
  IsDateString,
  MaxLength,
  ArrayMaxSize,
  IsUrl,
} from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdatePostDto {
  @ApiPropertyOptional({
    example: "Updated post content",
    description: "Post content (max 500 characters)",
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  content?: string;

  @ApiPropertyOptional({
    example: ["https://example.com/new-image.jpg"],
    description: "Array of media URLs (max 10)",
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUrl({}, { each: true })
  mediaUrls?: string[];

  @ApiPropertyOptional({
    example: "2024-12-26T10:00:00Z",
    description: "ISO 8601 date string for scheduled posting",
  })
  @IsOptional()
  @IsDateString()
  scheduledFor?: string;
}
