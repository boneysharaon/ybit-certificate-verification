export type CertificateRecord = {
  letterId: string;
  studentName: string;
  className: string;
  meritRank?: string;
  meritCategory?: string;
};

export type CertificateLookupResult =
  | {
      found: true;
      status: "valid";
      certificate: CertificateRecord;
    }
  | {
      found: true;
      status: "revoked";
    }
  | {
      found: false;
      status: "not_found";
    };

export type VerifyApiResponse =
  | {
      found: true;
      status: "valid";
      certificate: CertificateRecord;
    }
  | {
      found: true;
      status: "revoked";
    }
  | {
      found: false;
      status:
        | "invalid_input"
        | "not_found"
        | "configuration_error"
        | "server_error";
      message?: string;
    };
