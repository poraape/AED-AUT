export class GeminiApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiApiError';
  }
}

export class DataParsingError extends Error {
  public title?: string;
  constructor(message: string, title?: string) {
    super(message);
    this.name = 'DataParsingError';
    this.title = title;
  }
}
