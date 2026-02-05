export type User = {
  id: string;
  email: string;
  name?: string;
  picture?: string;
  roles?: string[];
};

export type Tokens = {
  accessToken: string;
};

export type Session = {
  user: User | null;
  authenticated: boolean;
};