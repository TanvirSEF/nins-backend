import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import SSLCommerzPayment = require('sslcommerz-lts');

@Injectable()
export class SslCommerzService {
  private readonly storeId: string;
  private readonly storePasswd: string;
  private readonly isLive: boolean;
  private readonly logger = new Logger(SslCommerzService.name);

  constructor(private configService: ConfigService) {
    this.storeId = this.configService.get<string>('SSLCOMMERZ_STORE_ID')!;
    this.storePasswd = this.configService.get<string>(
      'SSLCOMMERZ_STORE_PASSWORD',
    )!;
    this.isLive =
      this.configService.get<string>('SSLCOMMERZ_IS_LIVE') === 'true';

    this.logger.log(
      `SSLCommerz initialized — store: ${this.storeId}, mode: ${this.isLive ? 'LIVE' : 'SANDBOX'}`,
    );
  }

  /**
   * Initiate a new SSLCommerz payment session
   */
  async init(data: Record<string, any>): Promise<any> {
    const sslcz = new SSLCommerzPayment(
      this.storeId,
      this.storePasswd,
      this.isLive,
    );
    return sslcz.init(data);
  }

  /**
   * Validate a transaction using SSLCommerz validation API
   */
  async validate(valId: string): Promise<any> {
    const sslcz = new SSLCommerzPayment(
      this.storeId,
      this.storePasswd,
      this.isLive,
    );
    return sslcz.validate({ val_id: valId });
  }

  /**
   * Query transaction status by transaction ID
   */
  async queryByTransactionId(tranId: string): Promise<any> {
    const sslcz = new SSLCommerzPayment(
      this.storeId,
      this.storePasswd,
      this.isLive,
    );
    return sslcz.transactionQueryByTransactionId({ tran_id: tranId });
  }
}
