import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsOptional,
  IsIn,
  Matches,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class LinkAccountDto {
  @ApiProperty({
    example: "My Main Account",
    description: "Display name for the account",
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(50)
  name: string;

  @ApiProperty({
    example: "8888010131323883",
    description: "Threads User ID",
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(50)
  threadsUserId: string;

  @ApiProperty({
    example: "1234567890123456",
    description: "Threads App Client ID from Meta Developer Dashboard",
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(100)
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message:
      "Client ID must contain only alphanumeric characters, hyphens, and underscores",
  })
  clientId: string;

  @ApiProperty({
    example: "abcdef1234567890abcdef1234567890",
    description: "Threads App Client Secret from Meta Developer Dashboard",
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(20)
  @MaxLength(200)
  clientSecret: string;

  @ApiProperty({
    example: "THQVJ...",
    description: "Access Token obtained from Threads OAuth flow",
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  accessToken: string;

  @ApiPropertyOptional({
    example: "Asia/Tokyo",
    description: "Timezone for scheduled posts",
  })
  @IsOptional()
  @IsString()
  @IsIn([
    "Asia/Tokyo",
    "America/New_York",
    "America/Los_Angeles",
    "Europe/London",
    "Europe/Paris",
    "UTC",
  ])
  timezone?: string;
}
