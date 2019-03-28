import metadata from '../metadata';

const legacyMetadata = metadata.clone();
legacyMetadata.useLegacyApi = true;

export default legacyMetadata;
