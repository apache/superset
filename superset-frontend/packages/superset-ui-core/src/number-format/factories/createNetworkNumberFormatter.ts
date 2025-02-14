// @ts-nocheck

import { format as d3Format } from 'd3-format';
import NumberFormatter from '../NumberFormatter';
import NumberFormats from '../NumberFormats';

const float2PointFormatter = d3Format(`.2~f`);
const float4PointFormatter = d3Format(`.4~f`);

const bytesSILabels = ['Bytes', 'kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB'];
const bytesIECLabels = [
  'Bytes',
  'KiB',
  'MiB',
  'GiB',
  'TiB',
  'PiB',
  'EiB',
  'ZiB',
];
const bitrateSILabels = [
  'bits/s',
  'kb/s',
  'Mb/s',
  'Gb/s',
  'Tb/s',
  'Pb/s',
  'Eb/s',
  'Zb/s',
];
const bitrateIECLabels = [
  'bits/s',
  'Kib/s',
  'Mib/s',
  'Gib/s',
  'Tib/s',
  'Pib/s',
  'Eib/s',
  'Zib/s',
];
const byterateSILabels = [
  'Bytes/s',
  'kB/s',
  'MB/s',
  'GB/s',
  'TB/s',
  'PB/s',
  'EB/s',
  'ZB/s',
];
const byterateIECLabels = [
  'Bytes/s',
  'KiB/s',
  'MiB/s',
  'GiB/s',
  'TiB/s',
  'PiB/s',
  'EiB/s',
  'ZiB/s',
];

function formatValue(
  value: number,
  labels: any,
  base: number,
  decimals: number,
) {
  if (value === 0) {
    const formatted = `0 + ${labels[0]}`;
    return formatted;
  }

  const absoluteValue = Math.abs(value);
  if (absoluteValue >= 1000) {
    const i = Math.floor(Math.log(absoluteValue) / Math.log(base));
    const parsedVal = parseFloat(
      (absoluteValue / Math.pow(base, i)).toFixed(decimals),
    );
    return `${value < 0 ? '-' : ''}${parsedVal} ${labels[i]}`;
  }
  if (absoluteValue >= 1) {
    const formattedVal = `${float2PointFormatter(value)} ${labels[0]}`;
    return formattedVal;
  }
  if (absoluteValue >= 0.001) {
    return `${float4PointFormatter(value)} ${labels[0]}`;
  }

  const siFormatter = d3Format(`.${decimals}s`);
  if (absoluteValue > 0.000001) {
    return `${siFormatter(value * 1000000)}µ ${labels[0]}`;
  }
  return `${siFormatter(value)} ${labels[0]}`;
}

function formatBytesSI(value: number, decimals: number) {
  return formatValue(value, bytesSILabels, 1000, decimals);
}

function formatBytesIEC(value: number, decimals: number) {
  return formatValue(value, bytesIECLabels, 1024, decimals);
}

function formatBitrateSI(value: number, decimals: number) {
  return formatValue(value, bitrateSILabels, 1000, decimals);
}

function formatBitrateIEC(value: number, decimals: number) {
  return formatValue(value, bitrateIECLabels, 1024, decimals);
}

function formatByterateSI(value: number, decimals: number) {
  return formatValue(value, byterateSILabels, 1000, decimals);
}

function formatByterateIEC(value: number, decimals: number) {
  return formatValue(value, byterateIECLabels, 1024, decimals);
}

export default function createNetworkNumberFormatter(
  config: {
    description?: string;
    n?: number;
    id?: string;
    label?: string;
  } = {},
) {
  const { description, n = 3, id, label } = config;

  switch (id) {
    case NumberFormats.BYTES_IEC:
      return new NumberFormatter({
        description,
        formatFunc: value => formatBytesIEC(value, n),
        id,
        label: label ?? 'Bytes IEC Formatter',
      });
      break;
    case NumberFormats.BITRATE_SI:
      return new NumberFormatter({
        description,
        formatFunc: value => formatBitrateSI(value, n),
        id,
        label: label ?? 'Bitrate SI Formatter',
      });
      break;
    case NumberFormats.BITRATE_IEC:
      return new NumberFormatter({
        description,
        formatFunc: value => formatBitrateIEC(value, n),
        id,
        label: label ?? 'Bitrate IEC Formatter',
      });
      break;
    case NumberFormats.BYTERATE_SI:
      return new NumberFormatter({
        description,
        formatFunc: value => formatByterateSI(value, n),
        id,
        label: label ?? 'Byterate SI Formatter',
      });
      break;
    case NumberFormats.BYTERATE_IEC:
      return new NumberFormatter({
        description,
        formatFunc: value => formatByterateIEC(value, n),
        id,
        label: label ?? 'Byterate IEC Formatter',
      });
    case NumberFormats.BYTES_SI:
    default:
      return new NumberFormatter({
        description,
        formatFunc: value => formatBytesSI(value, n),
        id: id ?? NumberFormats.BYTES_SI,
        label: label ?? 'Bytes SI Formatter',
      });
  }
}
