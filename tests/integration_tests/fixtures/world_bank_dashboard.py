# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
import string
from operator import or_
from random import choice, randint, random, uniform
from typing import Any

import pandas as pd
import pytest
from pandas import DataFrame
from sqlalchemy import DateTime, String

from superset import db
from superset.connectors.sqla.models import SqlaTable
from superset.models.core import Database
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.reports.models import ReportSchedule
from superset.utils import json
from superset.utils.core import get_example_default_schema
from superset.utils.database import get_example_database
from tests.integration_tests.dashboard_utils import (
    create_dashboard,
    create_table_metadata,
)
from tests.integration_tests.test_app import app

WB_HEALTH_POPULATION = "wb_health_population"


@pytest.fixture(scope="session")
def load_world_bank_data():
    with app.app_context():
        database = get_example_database()
        dtype = {
            "year": DateTime if database.backend != "presto" else String(255),
            "country_code": String(3),
            "country_name": String(255),
            "region": String(255),
        }
        with database.get_sqla_engine() as engine:
            _get_dataframe(database).to_sql(
                WB_HEALTH_POPULATION,
                engine,
                if_exists="replace",
                chunksize=500,
                dtype=dtype,
                index=False,
                method="multi",
                schema=get_example_default_schema(),
            )

    yield
    with app.app_context():
        with get_example_database().get_sqla_engine() as engine:
            engine.execute("DROP TABLE IF EXISTS wb_health_population")


@pytest.fixture()
def load_world_bank_dashboard_with_slices(load_world_bank_data):
    with app.app_context():
        dash_id_to_delete, slices_ids_to_delete = create_dashboard_for_loaded_data()
        yield
        _cleanup(dash_id_to_delete, slices_ids_to_delete)


@pytest.fixture(scope="module")
def load_world_bank_dashboard_with_slices_module_scope(load_world_bank_data):
    with app.app_context():
        dash_id_to_delete, slices_ids_to_delete = create_dashboard_for_loaded_data()
        yield
        _cleanup_reports(dash_id_to_delete, slices_ids_to_delete)
        _cleanup(dash_id_to_delete, slices_ids_to_delete)


@pytest.fixture(scope="class")
def load_world_bank_dashboard_with_slices_class_scope(load_world_bank_data):
    with app.app_context():
        dash_id_to_delete, slices_ids_to_delete = create_dashboard_for_loaded_data()
        yield
        _cleanup(dash_id_to_delete, slices_ids_to_delete)


def create_dashboard_for_loaded_data():
    table = create_table_metadata(WB_HEALTH_POPULATION, get_example_database())
    slices = _create_world_bank_slices(table)
    dash = _create_world_bank_dashboard(table)
    slices_ids_to_delete = [slice.id for slice in slices]
    dash_id_to_delete = dash.id
    return dash_id_to_delete, slices_ids_to_delete


def _create_world_bank_slices(table: SqlaTable) -> list[Slice]:
    from superset.examples.world_bank import create_slices

    slices = create_slices(table)
    _commit_slices(slices)
    return slices


def _commit_slices(slices: list[Slice]):
    for slice in slices:
        o = db.session.query(Slice).filter_by(slice_name=slice.slice_name).one_or_none()
        if o:
            db.session.delete(o)
        db.session.add(slice)
        db.session.commit()


def _create_world_bank_dashboard(table: SqlaTable) -> Dashboard:
    from superset.examples.helpers import update_slice_ids
    from superset.examples.world_bank import dashboard_positions

    pos = dashboard_positions
    slices = update_slice_ids(pos)

    table.fetch_metadata()

    dash = create_dashboard(
        "world_health", "World Bank's Data", json.dumps(pos), slices
    )
    dash.json_metadata = '{"mock_key": "mock_value"}'
    db.session.commit()
    return dash


def _cleanup(dash_id: int, slices_ids: list[int]) -> None:
    dash = db.session.query(Dashboard).filter_by(id=dash_id).first()
    db.session.delete(dash)
    for slice_id in slices_ids:
        db.session.query(Slice).filter_by(id=slice_id).delete()
    db.session.commit()


def _cleanup_reports(dash_id: int, slices_ids: list[int]) -> None:
    reports = db.session.query(ReportSchedule).filter(
        or_(
            ReportSchedule.dashboard_id == dash_id,
            ReportSchedule.chart_id.in_(slices_ids),
        )
    )

    for report in reports:
        db.session.delete(report)
    db.session.commit()


def _get_dataframe(database: Database) -> DataFrame:
    data = _get_world_bank_data()
    df = pd.DataFrame.from_dict(data)
    if database.backend == "presto":
        df.year = pd.to_datetime(df.year)
        df.year = df.year.dt.strftime("%Y-%m-%d %H:%M%:%S")
    else:
        df.year = pd.to_datetime(df.year)

    return df


def _get_world_bank_data() -> list[dict[Any, Any]]:
    data = []
    for _ in range(100):
        data.append(
            {
                "country_name": "".join(
                    choice(string.ascii_uppercase + string.ascii_lowercase + " ")
                    for _ in range(randint(3, 10))
                ),
                "country_code": "".join(
                    choice(string.ascii_uppercase + string.ascii_lowercase)
                    for _ in range(3)
                ),
                "region": "".join(
                    choice(string.ascii_uppercase + string.ascii_lowercase)
                    for _ in range(randint(3, 10))
                ),
                "year": "-".join(
                    [str(randint(1900, 2020)), str(randint(1, 12)), str(randint(1, 28))]
                ),
                "NY_GNP_PCAP_CD": get_random_float_or_none(0, 100, 0.3),
                "SE_ADT_1524_LT_FM_ZS": get_random_float_or_none(0, 100, 0.3),
                "SE_ADT_1524_LT_MA_ZS": get_random_float_or_none(0, 100, 0.3),
                "SE_ADT_1524_LT_ZS": get_random_float_or_none(0, 100, 0.3),
                "SE_ADT_LITR_FE_ZS": get_random_float_or_none(0, 100, 0.3),
                "SE_ADT_LITR_MA_ZS": get_random_float_or_none(0, 100, 0.3),
                "SE_ADT_LITR_ZS": get_random_float_or_none(0, 100, 0.3),
                "SE_ENR_ORPH": get_random_float_or_none(0, 100, 0.3),
                "SE_PRM_CMPT_FE_ZS": get_random_float_or_none(0, 100, 0.3),
                "SE_PRM_CMPT_MA_ZS": get_random_float_or_none(0, 100, 0.3),
                "SE_PRM_CMPT_ZS": get_random_float_or_none(0, 100, 0.3),
                "SE_PRM_ENRR": get_random_float_or_none(0, 100, 0.3),
                "SE_PRM_ENRR_FE": get_random_float_or_none(0, 100, 0.3),
                "SE_PRM_ENRR_MA": get_random_float_or_none(0, 100, 0.3),
                "SE_PRM_NENR": get_random_float_or_none(0, 100, 0.3),
                "SE_PRM_NENR_FE": get_random_float_or_none(0, 100, 0.3),
                "SE_PRM_NENR_MA": get_random_float_or_none(0, 100, 0.3),
                "SE_SEC_ENRR": get_random_float_or_none(0, 100, 0.3),
                "SE_SEC_ENRR_FE": get_random_float_or_none(0, 100, 0.3),
                "SE_SEC_ENRR_MA": get_random_float_or_none(0, 100, 0.3),
                "SE_SEC_NENR": get_random_float_or_none(0, 100, 0.3),
                "SE_SEC_NENR_FE": get_random_float_or_none(0, 100, 0.3),
                "SE_SEC_NENR_MA": get_random_float_or_none(0, 100, 0.3),
                "SE_TER_ENRR": get_random_float_or_none(0, 100, 0.3),
                "SE_TER_ENRR_FE": get_random_float_or_none(0, 100, 0.3),
                "SE_XPD_TOTL_GD_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_ANM_CHLD_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_ANM_NPRG_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_CON_1524_FE_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_CON_1524_MA_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_CON_AIDS_FE_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_CON_AIDS_MA_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_DTH_COMM_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_DTH_IMRT": get_random_float_or_none(0, 100, 0.3),
                "SH_DTH_INJR_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_DTH_MORT": get_random_float_or_none(0, 100, 0.3),
                "SH_DTH_NCOM_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_DTH_NMRT": get_random_float_or_none(0, 100, 0.3),
                "SH_DYN_AIDS": get_random_float_or_none(0, 100, 0.3),
                "SH_DYN_AIDS_DH": get_random_float_or_none(0, 100, 0.3),
                "SH_DYN_AIDS_FE_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_DYN_AIDS_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_DYN_MORT": get_random_float_or_none(0, 100, 0.3),
                "SH_DYN_MORT_FE": get_random_float_or_none(0, 100, 0.3),
                "SH_DYN_MORT_MA": get_random_float_or_none(0, 100, 0.3),
                "SH_DYN_NMRT": get_random_float_or_none(0, 100, 0.3),
                "SH_FPL_SATI_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_H2O_SAFE_RU_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_H2O_SAFE_UR_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_H2O_SAFE_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_HIV_0014": get_random_float_or_none(0, 100, 0.3),
                "SH_HIV_1524_FE_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_HIV_1524_KW_FE_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_HIV_1524_KW_MA_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_HIV_1524_MA_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_HIV_ARTC_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_HIV_KNOW_FE_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_HIV_KNOW_MA_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_HIV_ORPH": get_random_float_or_none(0, 100, 0.3),
                "SH_HIV_TOTL": get_random_float_or_none(0, 100, 0.3),
                "SH_IMM_HEPB": get_random_float_or_none(0, 100, 0.3),
                "SH_IMM_HIB3": get_random_float_or_none(0, 100, 0.3),
                "SH_IMM_IBCG": get_random_float_or_none(0, 100, 0.3),
                "SH_IMM_IDPT": get_random_float_or_none(0, 100, 0.3),
                "SH_IMM_MEAS": get_random_float_or_none(0, 100, 0.3),
                "SH_IMM_POL3": get_random_float_or_none(0, 100, 0.3),
                "SH_MED_BEDS_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_MED_CMHW_P3": get_random_float_or_none(0, 100, 0.3),
                "SH_MED_NUMW_P3": get_random_float_or_none(0, 100, 0.3),
                "SH_MED_PHYS_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_MLR_NETS_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_MLR_PREG_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_MLR_SPF2_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_MLR_TRET_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_MMR_DTHS": get_random_float_or_none(0, 100, 0.3),
                "SH_MMR_LEVE": get_random_float_or_none(0, 100, 0.3),
                "SH_MMR_RISK": get_random_float_or_none(0, 100, 0.3),
                "SH_MMR_RISK_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_MMR_WAGE_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_PRG_ANEM": get_random_float_or_none(0, 100, 0.3),
                "SH_PRG_ARTC_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_PRG_SYPH_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_PRV_SMOK_FE": get_random_float_or_none(0, 100, 0.3),
                "SH_PRV_SMOK_MA": get_random_float_or_none(0, 100, 0.3),
                "SH_STA_ACSN": get_random_float_or_none(0, 100, 0.3),
                "SH_STA_ACSN_RU": get_random_float_or_none(0, 100, 0.3),
                "SH_STA_ACSN_UR": get_random_float_or_none(0, 100, 0.3),
                "SH_STA_ANV4_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_STA_ANVC_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_STA_ARIC_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_STA_BFED_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_STA_BRTC_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_STA_BRTW_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_STA_DIAB_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_STA_IYCF_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_STA_MALN_FE_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_STA_MALN_MA_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_STA_MALN_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_STA_MALR": get_random_float_or_none(0, 100, 0.3),
                "SH_STA_MMRT": get_random_float_or_none(0, 100, 0.3),
                "SH_STA_MMRT_NE": get_random_float_or_none(0, 100, 0.3),
                "SH_STA_ORCF_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_STA_ORTH": get_random_float_or_none(0, 100, 0.3),
                "SH_STA_OW15_FE_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_STA_OW15_MA_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_STA_OW15_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_STA_OWGH_FE_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_STA_OWGH_MA_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_STA_OWGH_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_STA_PNVC_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_STA_STNT_FE_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_STA_STNT_MA_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_STA_STNT_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_STA_WAST_FE_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_STA_WAST_MA_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_STA_WAST_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_SVR_WAST_FE_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_SVR_WAST_MA_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_SVR_WAST_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_TBS_CURE_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_TBS_DTEC_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_TBS_INCD": get_random_float_or_none(0, 100, 0.3),
                "SH_TBS_MORT": get_random_float_or_none(0, 100, 0.3),
                "SH_TBS_PREV": get_random_float_or_none(0, 100, 0.3),
                "SH_VAC_TTNS_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_XPD_EXTR_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_XPD_OOPC_TO_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_XPD_OOPC_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_XPD_PCAP": get_random_float_or_none(0, 100, 0.3),
                "SH_XPD_PCAP_PP_KD": get_random_float_or_none(0, 100, 0.3),
                "SH_XPD_PRIV": get_random_float_or_none(0, 100, 0.3),
                "SH_XPD_PRIV_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_XPD_PUBL": get_random_float_or_none(0, 100, 0.3),
                "SH_XPD_PUBL_GX_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_XPD_PUBL_ZS": get_random_float_or_none(0, 100, 0.3),
                "SH_XPD_TOTL_CD": get_random_float_or_none(0, 100, 0.3),
                "SH_XPD_TOTL_ZS": get_random_float_or_none(0, 100, 0.3),
                "SI_POV_NAHC": get_random_float_or_none(0, 100, 0.3),
                "SI_POV_RUHC": get_random_float_or_none(0, 100, 0.3),
                "SI_POV_URHC": get_random_float_or_none(0, 100, 0.3),
                "SL_EMP_INSV_FE_ZS": get_random_float_or_none(0, 100, 0.3),
                "SL_TLF_TOTL_FE_ZS": get_random_float_or_none(0, 100, 0.3),
                "SL_TLF_TOTL_IN": get_random_float_or_none(0, 100, 0.3),
                "SL_UEM_TOTL_FE_ZS": get_random_float_or_none(0, 100, 0.3),
                "SL_UEM_TOTL_MA_ZS": get_random_float_or_none(0, 100, 0.3),
                "SL_UEM_TOTL_ZS": get_random_float_or_none(0, 100, 0.3),
                "SM_POP_NETM": get_random_float_or_none(0, 100, 0.3),
                "SN_ITK_DEFC": get_random_float_or_none(0, 100, 0.3),
                "SN_ITK_DEFC_ZS": get_random_float_or_none(0, 100, 0.3),
                "SN_ITK_SALT_ZS": get_random_float_or_none(0, 100, 0.3),
                "SN_ITK_VITA_ZS": get_random_float_or_none(0, 100, 0.3),
                "SP_ADO_TFRT": get_random_float_or_none(0, 100, 0.3),
                "SP_DYN_AMRT_FE": get_random_float_or_none(0, 100, 0.3),
                "SP_DYN_AMRT_MA": get_random_float_or_none(0, 100, 0.3),
                "SP_DYN_CBRT_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_DYN_CDRT_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_DYN_CONU_ZS": get_random_float_or_none(0, 100, 0.3),
                "SP_DYN_IMRT_FE_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_DYN_IMRT_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_DYN_IMRT_MA_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_DYN_LE00_FE_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_DYN_LE00_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_DYN_LE00_MA_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_DYN_SMAM_FE": get_random_float_or_none(0, 100, 0.3),
                "SP_DYN_SMAM_MA": get_random_float_or_none(0, 100, 0.3),
                "SP_DYN_TFRT_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_DYN_TO65_FE_ZS": get_random_float_or_none(0, 100, 0.3),
                "SP_DYN_TO65_MA_ZS": get_random_float_or_none(0, 100, 0.3),
                "SP_DYN_WFRT": get_random_float_or_none(0, 100, 0.3),
                "SP_HOU_FEMA_ZS": get_random_float_or_none(0, 100, 0.3),
                "SP_MTR_1519_ZS": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_0004_FE": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_0004_FE_5Y": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_0004_MA": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_0004_MA_5Y": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_0014_FE_ZS": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_0014_MA_ZS": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_0014_TO": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_0014_TO_ZS": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_0509_FE": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_0509_FE_5Y": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_0509_MA": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_0509_MA_5Y": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_1014_FE": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_1014_FE_5Y": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_1014_MA": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_1014_MA_5Y": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_1519_FE": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_1519_FE_5Y": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_1519_MA": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_1519_MA_5Y": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_1564_FE_ZS": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_1564_MA_ZS": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_1564_TO": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_1564_TO_ZS": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_2024_FE": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_2024_FE_5Y": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_2024_MA": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_2024_MA_5Y": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_2529_FE": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_2529_FE_5Y": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_2529_MA": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_2529_MA_5Y": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_3034_FE": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_3034_FE_5Y": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_3034_MA": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_3034_MA_5Y": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_3539_FE": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_3539_FE_5Y": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_3539_MA": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_3539_MA_5Y": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_4044_FE": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_4044_FE_5Y": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_4044_MA": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_4044_MA_5Y": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_4549_FE": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_4549_FE_5Y": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_4549_MA": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_4549_MA_5Y": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_5054_FE": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_5054_FE_5Y": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_5054_MA": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_5054_MA_5Y": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_5559_FE": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_5559_FE_5Y": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_5559_MA": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_5559_MA_5Y": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_6064_FE": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_6064_FE_5Y": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_6064_MA": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_6064_MA_5Y": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_6569_FE": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_6569_FE_5Y": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_6569_MA": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_6569_MA_5Y": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_65UP_FE_ZS": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_65UP_MA_ZS": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_65UP_TO": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_65UP_TO_ZS": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_7074_FE": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_7074_FE_5Y": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_7074_MA": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_7074_MA_5Y": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_7579_FE": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_7579_FE_5Y": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_7579_MA": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_7579_MA_5Y": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_80UP_FE": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_80UP_FE_5Y": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_80UP_MA": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_80UP_MA_5Y": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_AG00_FE_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_AG00_MA_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_AG01_FE_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_AG01_MA_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_AG02_FE_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_AG02_MA_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_AG03_FE_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_AG03_MA_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_AG04_FE_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_AG04_MA_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_AG05_FE_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_AG05_MA_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_AG06_FE_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_AG06_MA_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_AG07_FE_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_AG07_MA_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_AG08_FE_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_AG08_MA_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_AG09_FE_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_AG09_MA_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_AG10_FE_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_AG10_MA_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_AG11_FE_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_AG11_MA_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_AG12_FE_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_AG12_MA_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_AG13_FE_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_AG13_MA_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_AG14_FE_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_AG14_MA_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_AG15_FE_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_AG15_MA_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_AG16_FE_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_AG16_MA_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_AG17_FE_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_AG17_MA_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_AG18_FE_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_AG18_MA_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_AG19_FE_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_AG19_MA_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_AG20_FE_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_AG20_MA_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_AG21_FE_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_AG21_MA_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_AG22_FE_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_AG22_MA_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_AG23_FE_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_AG23_MA_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_AG24_FE_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_AG24_MA_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_AG25_FE_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_AG25_MA_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_BRTH_MF": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_DPND": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_DPND_OL": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_DPND_YG": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_GROW": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_TOTL": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_TOTL_FE_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_TOTL_FE_ZS": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_TOTL_MA_IN": get_random_float_or_none(0, 100, 0.3),
                "SP_POP_TOTL_MA_ZS": get_random_float_or_none(0, 100, 0.3),
                "SP_REG_BRTH_RU_ZS": get_random_float_or_none(0, 100, 0.3),
                "SP_REG_BRTH_UR_ZS": get_random_float_or_none(0, 100, 0.3),
                "SP_REG_BRTH_ZS": get_random_float_or_none(0, 100, 0.3),
                "SP_REG_DTHS_ZS": get_random_float_or_none(0, 100, 0.3),
                "SP_RUR_TOTL": get_random_float_or_none(0, 100, 0.3),
                "SP_RUR_TOTL_ZG": get_random_float_or_none(0, 100, 0.3),
                "SP_RUR_TOTL_ZS": get_random_float_or_none(0, 100, 0.3),
                "SP_URB_GROW": get_random_float_or_none(0, 100, 0.3),
                "SP_URB_TOTL": get_random_float_or_none(0, 100, 0.3),
                "SP_URB_TOTL_IN_ZS": get_random_float_or_none(0, 100, 0.3),
                "SP_UWT_TFRT": get_random_float_or_none(0, 100, 0.3),
            }
        )

    return data


def get_random_float_or_none(min_value, max_value, none_probability):
    if random() < none_probability:
        return None
    else:
        return uniform(min_value, max_value)
