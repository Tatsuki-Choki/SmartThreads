import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsNotEmpty, IsOptional } from "class-validator";

export class TestPostDto {
  @ApiProperty({
    description: "Threads access token",
    example: "TH-YOUR-ACCESS-TOKEN-HERE",
  })
  @IsString()
  @IsNotEmpty()
  accessToken: string;

  @ApiProperty({
    description: "Threads user ID",
    example: "12345678901234567",
  })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    description: "Custom text for the test post (optional)",
    example: "My custom test message",
    required: false,
  })
  @IsString()
  @IsOptional()
  text?: string;
}
