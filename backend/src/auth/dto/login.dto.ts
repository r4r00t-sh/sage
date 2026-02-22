import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsNotEmpty({ message: 'username is required' })
  @IsString()
  username: string;

  @IsNotEmpty({ message: 'password is required' })
  @IsString()
  @MinLength(1, { message: 'password is required' })
  password: string;
}
