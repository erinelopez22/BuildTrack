export class CreateUserDTO {
  email!: string;
  full_name!: string;
  password!: string;
  phone?: string;
  roles!: string[];
}

export class UpdateUserDTO {
  full_name?: string;
  phone?: string;
  avatar_url?: string;
  sms_opt_in?: boolean;
  notification_preferences?: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
}

export class UserResponseDTO {
  id!: string;
  email!: string;
  full_name!: string;
  phone?: string;
  avatar_url?: string;
  sms_opt_in!: boolean;
  is_active!: boolean;
  roles!: string[];
  created_at!: string;
  updated_at!: string;
}

export class LoginDTO {
  email!: string;
  password!: string;
}

export class LoginResponseDTO {
  access_token!: string;
  user!: UserResponseDTO;
}

export class ChangePasswordDTO {
  current_password!: string;
  new_password!: string;
  confirm_password!: string;
}
