declare module 'sslcommerz-lts' {
  class SSLCommerzPayment {
    constructor(store_id: string, store_passwd: string, is_live: boolean);
    init(data: Record<string, any>): Promise<any>;
    validate(data: { val_id: string }): Promise<any>;
    initiateRefund(data: Record<string, any>): Promise<any>;
    refundQuery(data: Record<string, any>): Promise<any>;
    transactionQueryByTransactionId(data: { tran_id: string }): Promise<any>;
    transactionQueryBySessionId(data: { sessionkey: string }): Promise<any>;
  }
  export = SSLCommerzPayment;
}
