import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsDateString,
  IsUUID,
  MaxLength,
  ArrayMaxSize,
  IsUrl,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreatePostDto {
  @ApiProperty({
    example: "550e8400-e29b-41d4-a716-446655440000",
    description: "Account ID to post from",
  })
  @IsUUID()
  @IsNotEmpty()
  accountId: string;

  @ApiProperty({
    example: "Check out our new product launch! 🚀",
    description: "Post content (max 500 characters)",
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  content: string;

  @ApiPropertyOptional({
    example: [
      "https://example.com/image1.jpg",
      "https://example.com/image2.jpg",
    ],
    description: "Array of media URLs (max 10)",
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUrl({}, { each: true })
  mediaUrls?: string[];

  @ApiPropertyOptional({
    example: "2024-12-25T10:00:00Z",
    description: "ISO 8601 date string for scheduled posting",
  })
  @IsOptional()
  @IsDateString()
  scheduledFor?: string;
}
