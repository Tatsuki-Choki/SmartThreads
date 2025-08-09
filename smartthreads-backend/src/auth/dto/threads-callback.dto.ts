import { IsString, IsOptional, IsNotEmpty } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class ThreadsCallbackDto {
  @ApiProperty({
    description: "Authorization code from Threads OAuth",
    example: "AQDp3TtBQQ...",
  })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({
    description: "State parameter for CSRF protection",
    required: false,
  })
  @IsString()
  @IsOptional()
  state?: string;

  @ApiProperty({
    description: "Error parameter if authorization failed",
    required: false,
  })
  @IsString()
  @IsOptional()
  error?: string;

  @ApiProperty({
    description: "Error description if authorization failed",
    required: false,
  })
  @IsString()
  @IsOptional()
  error_description?: string;
}
