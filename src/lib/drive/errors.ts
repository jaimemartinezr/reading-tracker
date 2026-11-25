export type DriveErrorCode =
  | 'auth'
  | 'permission'
  | 'offline'
  | 'not-found'
  | 'conflict'
  | 'invalid'
  | 'api';

export class DriveError extends Error {
  readonly code: DriveErrorCode;
  readonly status?: number;

  constructor(code: DriveErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'DriveError';
    this.code = code;
    this.status = status;
  }
}

export class DriveAuthError extends DriveError {
  constructor(message: string, status = 401) {
    super('auth', message, status);
    this.name = 'DriveAuthError';
  }
}

export class DriveNotFoundError extends DriveError {
  constructor(message = 'No se encontró el archivo en Google Drive.') {
    super('not-found', message, 404);
    this.name = 'DriveNotFoundError';
  }
}

export class DriveConflictError extends DriveError {
  constructor(message = 'El archivo se modificó en otro dispositivo.') {
    super('conflict', message, 412);
    this.name = 'DriveConflictError';
  }
}

export class GoogleApiError extends DriveError {
  constructor(message: string, status: number) {
    super(status === 403 ? 'permission' : 'api', message, status);
    this.name = 'GoogleApiError';
  }
}
