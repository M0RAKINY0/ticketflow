export type Role = 'USER' | 'ORGANIZER' | 'ADMIN';

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  phoneNumber: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
};

export type AuthSession = {
  accessToken: string;
  user: PublicUser;
};

export type ApiErrorBody = {
  code: string;
  message: string;
  details?: unknown;
};
