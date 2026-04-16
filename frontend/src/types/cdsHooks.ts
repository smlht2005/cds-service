export interface CdsHookRequest {
  hook: string;
  context: {
    patientId?: string;
    [k: string]: unknown;
  };
  prefetch?: Record<string, unknown>;
}

export interface CdsCardExtension {
  url: string;
  valueString?: string;
}

export interface CdsCardLink {
  label: string;
  type?: string;
  url: string;
}

export interface CdsCardSource {
  label?: string;
  url?: string;
}

export interface CdsCard {
  uuid?: string;
  summary?: string;
  indicator?: 'info' | 'warning' | 'critical' | string;
  source?: CdsCardSource;
  detail?: string;
  links?: CdsCardLink[];
  extension?: CdsCardExtension[];
}

export interface CdsHookResponse {
  cards: CdsCard[];
}

export interface OperationOutcomeIssue {
  severity?: string;
  code?: string;
  diagnostics?: string;
}

export interface OperationOutcome {
  resourceType: 'OperationOutcome';
  issue?: OperationOutcomeIssue[];
}

