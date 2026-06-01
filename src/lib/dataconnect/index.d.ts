import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, ExecuteQueryOptions, MutationRef, MutationPromise } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;




export interface BusinessProfile_Key {
  id: UUIDString;
  __typename?: 'BusinessProfile_Key';
}

export interface CreatePipelineApplicationData {
  pipelineApplication_insert: PipelineApplication_Key;
}

export interface CreatePipelineApplicationVariables {
  tenantId: UUIDString;
  opportunityId: UUIDString;
  status: string;
}

export interface ListOpportunitiesData {
  opportunities: ({
    id: UUIDString;
    noticeId: string;
    title: string;
    agency: string;
    solicitationNumber?: string | null;
    naicsCode?: string | null;
    setAsideType?: string | null;
    postedDate: TimestampString;
    responseDeadline?: TimestampString | null;
    estimatedValue?: number | null;
    sourceUrl: string;
  } & Opportunity_Key)[];
}

export interface ListPipelineApplicationsData {
  pipelineApplications: ({
    id: UUIDString;
    opportunity: {
      id: UUIDString;
      title: string;
      agency: string;
      responseDeadline?: TimestampString | null;
    } & Opportunity_Key;
      status: string;
      fitScore?: number | null;
      createdAt: TimestampString;
  } & PipelineApplication_Key)[];
}

export interface ListPipelineApplicationsVariables {
  tenantId: UUIDString;
}

export interface Opportunity_Key {
  id: UUIDString;
  __typename?: 'Opportunity_Key';
}

export interface PipelineApplication_Key {
  id: UUIDString;
  __typename?: 'PipelineApplication_Key';
}

export interface Tenant_Key {
  id: UUIDString;
  __typename?: 'Tenant_Key';
}

export interface User_Key {
  uid: string;
  __typename?: 'User_Key';
}

interface CreatePipelineApplicationRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreatePipelineApplicationVariables): MutationRef<CreatePipelineApplicationData, CreatePipelineApplicationVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreatePipelineApplicationVariables): MutationRef<CreatePipelineApplicationData, CreatePipelineApplicationVariables>;
  operationName: string;
}
export const createPipelineApplicationRef: CreatePipelineApplicationRef;

export function createPipelineApplication(vars: CreatePipelineApplicationVariables): MutationPromise<CreatePipelineApplicationData, CreatePipelineApplicationVariables>;
export function createPipelineApplication(dc: DataConnect, vars: CreatePipelineApplicationVariables): MutationPromise<CreatePipelineApplicationData, CreatePipelineApplicationVariables>;

interface ListOpportunitiesRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListOpportunitiesData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListOpportunitiesData, undefined>;
  operationName: string;
}
export const listOpportunitiesRef: ListOpportunitiesRef;

export function listOpportunities(options?: ExecuteQueryOptions): QueryPromise<ListOpportunitiesData, undefined>;
export function listOpportunities(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListOpportunitiesData, undefined>;

interface ListPipelineApplicationsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListPipelineApplicationsVariables): QueryRef<ListPipelineApplicationsData, ListPipelineApplicationsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListPipelineApplicationsVariables): QueryRef<ListPipelineApplicationsData, ListPipelineApplicationsVariables>;
  operationName: string;
}
export const listPipelineApplicationsRef: ListPipelineApplicationsRef;

export function listPipelineApplications(vars: ListPipelineApplicationsVariables, options?: ExecuteQueryOptions): QueryPromise<ListPipelineApplicationsData, ListPipelineApplicationsVariables>;
export function listPipelineApplications(dc: DataConnect, vars: ListPipelineApplicationsVariables, options?: ExecuteQueryOptions): QueryPromise<ListPipelineApplicationsData, ListPipelineApplicationsVariables>;

