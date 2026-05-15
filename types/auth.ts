export interface LoginFormValues {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface RegisterFormValues {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
}

export interface FieldErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
  fullName?: string;
  acceptTerms?: string;
}
