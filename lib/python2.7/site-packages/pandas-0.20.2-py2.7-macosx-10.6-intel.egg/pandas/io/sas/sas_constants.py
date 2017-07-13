magic = (b"\x00\x00\x00\x00\x00\x00\x00\x00" +
         b"\x00\x00\x00\x00\xc2\xea\x81\x60" +
         b"\xb3\x14\x11\xcf\xbd\x92\x08\x00" +
         b"\x09\xc7\x31\x8c\x18\x1f\x10\x11")

align_1_checker_value = b'3'
align_1_offset = 32
align_1_length = 1
align_1_value = 4
u64_byte_checker_value = b'3'
align_2_offset = 35
align_2_length = 1
align_2_value = 4
endianness_offset = 37
endianness_length = 1
platform_offset = 39
platform_length = 1
encoding_offset = 70
encoding_length = 1
dataset_offset = 92
dataset_length = 64
file_type_offset = 156
file_type_length = 8
date_created_offset = 164
date_created_length = 8
date_modified_offset = 172
date_modified_length = 8
header_size_offset = 196
header_size_length = 4
page_size_offset = 200
page_size_length = 4
page_count_offset = 204
page_count_length = 4
sas_release_offset = 216
sas_release_length = 8
sas_server_type_offset = 224
sas_server_type_length = 16
os_version_number_offset = 240
os_version_number_length = 16
os_maker_offset = 256
os_maker_length = 16
os_name_offset = 272
os_name_length = 16
page_bit_offset_x86 = 16
page_bit_offset_x64 = 32
subheader_pointer_length_x86 = 12
subheader_pointer_length_x64 = 24
page_type_offset = 0
page_type_length = 2
block_count_offset = 2
block_count_length = 2
subheader_count_offset = 4
subheader_count_length = 2
page_meta_type = 0
page_data_type = 256
page_amd_type = 1024
page_metc_type = 16384
page_comp_type = -28672
page_mix_types = [512, 640]
subheader_pointers_offset = 8
truncated_subheader_id = 1
compressed_subheader_id = 4
compressed_subheader_type = 1
text_block_size_length = 2
row_length_offset_multiplier = 5
row_count_offset_multiplier = 6
col_count_p1_multiplier = 9
col_count_p2_multiplier = 10
row_count_on_mix_page_offset_multiplier = 15
column_name_pointer_length = 8
column_name_text_subheader_offset = 0
column_name_text_subheader_length = 2
column_name_offset_offset = 2
column_name_offset_length = 2
column_name_length_offset = 4
column_name_length_length = 2
column_data_offset_offset = 8
column_data_length_offset = 8
column_data_length_length = 4
column_type_offset = 14
column_type_length = 1
column_format_text_subheader_index_offset = 22
column_format_text_subheader_index_length = 2
column_format_offset_offset = 24
column_format_offset_length = 2
column_format_length_offset = 26
column_format_length_length = 2
column_label_text_subheader_index_offset = 28
column_label_text_subheader_index_length = 2
column_label_offset_offset = 30
column_label_offset_length = 2
column_label_length_offset = 32
column_label_length_length = 2
rle_compression = b'SASYZCRL'
rdc_compression = b'SASYZCR2'

compression_literals = [rle_compression, rdc_compression]

# Incomplete list of encodings, using SAS nomenclature:
# http://support.sas.com/documentation/cdl/en/nlsref/61893/HTML/default/viewer.htm#a002607278.htm
encoding_names = {29: "latin1", 20: "utf-8", 33: "cyrillic", 60: "wlatin2",
                  61: "wcyrillic", 62: "wlatin1", 90: "ebcdic870"}


class index:
    rowSizeIndex = 0
    columnSizeIndex = 1
    subheaderCountsIndex = 2
    columnTextIndex = 3
    columnNameIndex = 4
    columnAttributesIndex = 5
    formatAndLabelIndex = 6
    columnListIndex = 7
    dataSubheaderIndex = 8


subheader_signature_to_index = {
    b"\xF7\xF7\xF7\xF7": index.rowSizeIndex,
    b"\x00\x00\x00\x00\xF7\xF7\xF7\xF7": index.rowSizeIndex,
    b"\xF7\xF7\xF7\xF7\x00\x00\x00\x00": index.rowSizeIndex,
    b"\xF7\xF7\xF7\xF7\xFF\xFF\xFB\xFE": index.rowSizeIndex,
    b"\xF6\xF6\xF6\xF6": index.columnSizeIndex,
    b"\x00\x00\x00\x00\xF6\xF6\xF6\xF6": index.columnSizeIndex,
    b"\xF6\xF6\xF6\xF6\x00\x00\x00\x00": index.columnSizeIndex,
    b"\xF6\xF6\xF6\xF6\xFF\xFF\xFB\xFE": index.columnSizeIndex,
    b"\x00\xFC\xFF\xFF": index.subheaderCountsIndex,
    b"\xFF\xFF\xFC\x00": index.subheaderCountsIndex,
    b"\x00\xFC\xFF\xFF\xFF\xFF\xFF\xFF": index.subheaderCountsIndex,
    b"\xFF\xFF\xFF\xFF\xFF\xFF\xFC\x00": index.subheaderCountsIndex,
    b"\xFD\xFF\xFF\xFF": index.columnTextIndex,
    b"\xFF\xFF\xFF\xFD": index.columnTextIndex,
    b"\xFD\xFF\xFF\xFF\xFF\xFF\xFF\xFF": index.columnTextIndex,
    b"\xFF\xFF\xFF\xFF\xFF\xFF\xFF\xFD": index.columnTextIndex,
    b"\xFF\xFF\xFF\xFF": index.columnNameIndex,
    b"\xFF\xFF\xFF\xFF\xFF\xFF\xFF\xFF": index.columnNameIndex,
    b"\xFC\xFF\xFF\xFF": index.columnAttributesIndex,
    b"\xFF\xFF\xFF\xFC": index.columnAttributesIndex,
    b"\xFC\xFF\xFF\xFF\xFF\xFF\xFF\xFF": index.columnAttributesIndex,
    b"\xFF\xFF\xFF\xFF\xFF\xFF\xFF\xFC": index.columnAttributesIndex,
    b"\xFE\xFB\xFF\xFF": index.formatAndLabelIndex,
    b"\xFF\xFF\xFB\xFE": index.formatAndLabelIndex,
    b"\xFE\xFB\xFF\xFF\xFF\xFF\xFF\xFF": index.formatAndLabelIndex,
    b"\xFF\xFF\xFF\xFF\xFF\xFF\xFB\xFE": index.formatAndLabelIndex,
    b"\xFE\xFF\xFF\xFF": index.columnListIndex,
    b"\xFF\xFF\xFF\xFE": index.columnListIndex,
    b"\xFE\xFF\xFF\xFF\xFF\xFF\xFF\xFF": index.columnListIndex,
    b"\xFF\xFF\xFF\xFF\xFF\xFF\xFF\xFE": index.columnListIndex}
