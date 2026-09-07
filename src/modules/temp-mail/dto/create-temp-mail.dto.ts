/**
 * Data Transfer Object for creating temporary email addresses.
 */
export class CreateTempMailDto {
  public readonly duration: number;

  constructor(data: { duration?: number } = {}) {
    this.duration = Number(data.duration) || 60;
    this.validate();
  }

  validate(): void {
    if (this.duration <= 0 || this.duration > 1440) {
      throw new Error('Duration must be between 1 and 1440 minutes');
    }
  }
}
