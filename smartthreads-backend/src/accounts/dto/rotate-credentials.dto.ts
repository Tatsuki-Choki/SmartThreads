import { IsString, IsNotEmpty, MinLength, IsOptional } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class RotateCredentialsDto {
  @ApiPropertyOptional({
    example: "1234567890123456",
    description: "New Client ID (optional)",
  })
  @IsOptional()
  @IsString()
  @MinLength(10)
  clientId?: string;

  @ApiPropertyOptional({
    example: "abcdef1234567890abcdef1234567890",
    description: "New Client Secret (optional)",
  })
  @IsOptional()
  @IsString()
  @MinLength(20)
  clientSecret?: string;

  @ApiProperty({
    example: "THQVJ...",
    description: "New Access Token (required)",
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  accessToken: string;
}
