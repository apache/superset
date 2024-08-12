<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
-->
This data was downloaded from the
[World's Health Organization's website](https://datacatalog.worldbank.org/dataset/health-nutrition-and-population-statistics)

Here's the script that was used to massage the data:

    DIR = ""
    df_country = pd.read_csv(DIR + '/HNP_Country.csv')
    df_country.columns = ['country_code'] + list(df_country.columns[1:])
    df_country = df_country[['country_code', 'Region']]
    df_country.columns = ['country_code', 'region']

    df = pd.read_csv(DIR + '/HNP_Data.csv')
    del df['Unnamed: 60']
    df.columns = ['country_name', 'country_code'] + list(df.columns[2:])
    ndf = df.merge(df_country, how='inner')

    dims = ('country_name', 'country_code', 'region')
    vv = [str(i) for i in range(1960, 2015)]
    mdf = pd.melt(ndf, id_vars=dims + ('Indicator Code',), value_vars=vv)
    mdf['year'] = mdf.variable + '-01-01'
    dims = dims + ('year',)

    pdf = mdf.pivot_table(values='value', columns='Indicator Code', index=dims)
    pdf = pdf.reset_index()
    pdf.to_csv(DIR + '/countries.csv')
    pdf.to_json(DIR + '/countries.json', orient='records')

Here's the description of the metrics available:

Series | Code Indicator Name
--- | ---
NY.GNP.PCAP.CD | GNI per capita, Atlas method (current US$)
SE.ADT.1524.LT.FM.ZS | Literacy rate, youth (ages 15-24), gender parity index (GPI)
SE.ADT.1524.LT.MA.ZS | Literacy rate, youth male (% of males ages 15-24)
SE.ADT.1524.LT.ZS | Literacy rate, youth total (% of people ages 15-24)
SE.ADT.LITR.FE.ZS | Literacy rate, adult female (% of females ages 15 and above)
SE.ADT.LITR.MA.ZS | Literacy rate, adult male (% of males ages 15 and above)
SE.ADT.LITR.ZS | Literacy rate, adult total (% of people ages 15 and above)
SE.ENR.ORPH | Ratio of school attendance of orphans to school attendance of non-orphans ages 10-14
SE.PRM.CMPT.FE.ZS | Primary completion rate, female (% of relevant age group)
SE.PRM.CMPT.MA.ZS | Primary completion rate, male (% of relevant age group)
SE.PRM.CMPT.ZS | Primary completion rate, total (% of relevant age group)
SE.PRM.ENRR | School enrollment, primary (% gross)
SE.PRM.ENRR.FE | School enrollment, primary, female (% gross)
SE.PRM.ENRR.MA | School enrollment, primary, male (% gross)
SE.PRM.NENR | School enrollment, primary (% net)
SE.PRM.NENR.FE | School enrollment, primary, female (% net)
SE.PRM.NENR.MA | School enrollment, primary, male (% net)
SE.SEC.ENRR | School enrollment, secondary (% gross)
SE.SEC.ENRR.FE | School enrollment, secondary, female (% gross)
SE.SEC.ENRR.MA | School enrollment, secondary, male (% gross)
SE.SEC.NENR | School enrollment, secondary (% net)
SE.SEC.NENR.FE | School enrollment, secondary, female (% net)
SE.SEC.NENR.MA | School enrollment, secondary, male (% net)
SE.TER.ENRR | School enrollment, tertiary (% gross)
SE.TER.ENRR.FE | School enrollment, tertiary, female (% gross)
SE.XPD.TOTL.GD.ZS | Government expenditure on education, total (% of GDP)
SH.ANM.CHLD.ZS | Prevalence of anemia among children (% of children under 5)
SH.ANM.NPRG.ZS | Prevalence of anemia among non-pregnant women (% of women ages 15-49)
SH.CON.1524.FE.ZS | Condom use, population ages 15-24, female (% of females ages 15-24)
SH.CON.1524.MA.ZS | Condom use, population ages 15-24, male (% of males ages 15-24)
SH.CON.AIDS.FE.ZS | Condom use at last high-risk sex, adult female (% ages 15-49)
SH.CON.AIDS.MA.ZS | Condom use at last high-risk sex, adult male (% ages 15-49)
SH.DTH.COMM.ZS | Cause of death, by communicable diseases and maternal, prenatal and nutrition conditions (% of total)
SH.DTH.IMRT | Number of infant deaths
SH.DTH.INJR.ZS | Cause of death, by injury (% of total)
SH.DTH.MORT | Number of under-five deaths
SH.DTH.NCOM.ZS | Cause of death, by non-communicable diseases (% of total)
SH.DTH.NMRT | Number of neonatal deaths
SH.DYN.AIDS | Adults (ages 15+) living with HIV
SH.DYN.AIDS.DH | AIDS estimated deaths (UNAIDS estimates)
SH.DYN.AIDS.FE.ZS | Women's share of population ages 15+ living with HIV (%)
SH.DYN.AIDS.ZS | Prevalence of HIV, total (% of population ages 15-49)
SH.DYN.MORT | Mortality rate, under-5 (per 1,000 live births)
SH.DYN.MORT.FE | Mortality rate, under-5, female (per 1,000 live births)
SH.DYN.MORT.MA | Mortality rate, under-5, male (per 1,000 live births)
SH.DYN.NMRT | Mortality rate, neonatal (per 1,000 live births)
SH.FPL.SATI.ZS | Met need for contraception (% of married women ages 15-49)
SH.H2O.SAFE.RU.ZS | Improved water source, rural (% of rural population with access)
SH.H2O.SAFE.UR.ZS | Improved water source, urban (% of urban population with access)
SH.H2O.SAFE.ZS | Improved water source (% of population with access)
SH.HIV.0014 | Children (0-14) living with HIV
SH.HIV.1524.FE.ZS | Prevalence of HIV, female (% ages 15-24)
SH.HIV.1524.KW.FE.ZS | Comprehensive correct knowledge of HIV/AIDS, ages 15-24, female (2 prevent ways and reject 3 misconceptions)
SH.HIV.1524.KW.MA.ZS | Comprehensive correct knowledge of HIV/AIDS, ages 15-24, male (2 prevent ways and reject 3 misconceptions)
SH.HIV.1524.MA.ZS | Prevalence of HIV, male (% ages 15-24)
SH.HIV.ARTC.ZS | Antiretroviral therapy coverage (% of people living with HIV)
SH.HIV.KNOW.FE.ZS | % of females ages 15-49 having comprehensive correct knowledge about HIV (2 prevent ways and reject 3 misconceptions)
SH.HIV.KNOW.MA.ZS | % of males ages 15-49 having comprehensive correct knowledge about HIV (2 prevent ways and reject 3 misconceptions)
SH.HIV.ORPH | Children orphaned by HIV/AIDS
SH.HIV.TOTL | Adults (ages 15+) and children (0-14 years) living with HIV
SH.IMM.HEPB | Immunization, HepB3 (% of one-year-old children)
SH.IMM.HIB3 | Immunization, Hib3 (% of children ages 12-23 months)
SH.IMM.IBCG | Immunization, BCG (% of one-year-old children)
SH.IMM.IDPT | Immunization, DPT (% of children ages 12-23 months)
SH.IMM.MEAS | Immunization, measles (% of children ages 12-23 months)
SH.IMM.POL3 | Immunization, Pol3 (% of one-year-old children)
SH.MED.BEDS.ZS | Hospital beds (per 1,000 people)
SH.MED.CMHW.P3 | Community health workers (per 1,000 people)
SH.MED.NUMW.P3 | Nurses and midwives (per 1,000 people)
SH.MED.PHYS.ZS | Physicians (per 1,000 people)
SH.MLR.NETS.ZS | Use of insecticide-treated bed nets (% of under-5 population)
SH.MLR.PREG.ZS | Use of any antimalarial drug (% of pregnant women)
SH.MLR.SPF2.ZS | Use of Intermittent Preventive Treatment of malaria, 2+ doses of SP/Fansidar (% of pregnant women)
SH.MLR.TRET.ZS | Children with fever receiving antimalarial drugs (% of children under age 5 with fever)
SH.MMR.DTHS | Number of maternal deaths
SH.MMR.LEVE | Number of weeks of maternity leave
SH.MMR.RISK | Lifetime risk of maternal death (1 in: rate varies by country)
SH.MMR.RISK.ZS | Lifetime risk of maternal death (%)
SH.MMR.WAGE.ZS | Maternal leave benefits (% of wages paid in covered period)
SH.PRG.ANEM | Prevalence of anemia among pregnant women (%)
SH.PRG.ARTC.ZS | Antiretroviral therapy coverage (% of pregnant women living with HIV)
SH.PRG.SYPH.ZS | Prevalence of syphilis (% of women attending antenatal care)
SH.PRV.SMOK.FE | Smoking prevalence, females (% of adults)
SH.PRV.SMOK.MA | Smoking prevalence, males (% of adults)
SH.STA.ACSN | Improved sanitation facilities (% of population with access)
SH.STA.ACSN.RU | Improved sanitation facilities, rural (% of rural population with access)
SH.STA.ACSN.UR | Improved sanitation facilities, urban (% of urban population with access)
SH.STA.ANV4.ZS | Pregnant women receiving prenatal care of at least four visits (% of pregnant women)
SH.STA.ANVC.ZS | Pregnant women receiving prenatal care (%)
SH.STA.ARIC.ZS | ARI treatment (% of children under 5 taken to a health provider)
SH.STA.BFED.ZS | Exclusive breastfeeding (% of children under 6 months)
SH.STA.BRTC.ZS | Births attended by skilled health staff (% of total)
SH.STA.BRTW.ZS | Low-birthweight babies (% of births)
SH.STA.DIAB.ZS | Diabetes prevalence (% of population ages 20 to 79)
SH.STA.IYCF.ZS | Infant and young child feeding practices, all 3 IYCF (% children ages 6-23 months)
SH.STA.MALN.FE.ZS | Prevalence of underweight, weight for age, female (% of children under 5)
SH.STA.MALN.MA.ZS | Prevalence of underweight, weight for age, male (% of children under 5)
SH.STA.MALN.ZS | Prevalence of underweight, weight for age (% of children under 5)
SH.STA.MALR | Malaria cases reported
SH.STA.MMRT | Maternal mortality ratio (modeled estimate, per 100,000 live births)
SH.STA.MMRT.NE | Maternal mortality ratio (national estimate, per 100,000 live births)
SH.STA.ORCF.ZS | Diarrhea treatment (% of children under 5 receiving oral rehydration and continued feeding)
SH.STA.ORTH | Diarrhea treatment (% of children under 5 who received ORS packet)
SH.STA.OW15.FE.ZS | Prevalence of overweight, female (% of female adults)
SH.STA.OW15.MA.ZS | Prevalence of overweight, male (% of male adults)
SH.STA.OW15.ZS | Prevalence of overweight (% of adults)
SH.STA.OWGH.FE.ZS | Prevalence of overweight, weight for height, female (% of children under 5)
SH.STA.OWGH.MA.ZS | Prevalence of overweight, weight for height, male (% of children under 5)
SH.STA.OWGH.ZS | Prevalence of overweight, weight for height (% of children under 5)
SH.STA.PNVC.ZS | Postnatal care coverage (% mothers)
SH.STA.STNT.FE.ZS | Prevalence of stunting, height for age, female (% of children under 5)
SH.STA.STNT.MA.ZS | Prevalence of stunting, height for age, male (% of children under 5)
SH.STA.STNT.ZS | Prevalence of stunting, height for age (% of children under 5)
SH.STA.WAST.FE.ZS | Prevalence of wasting, weight for height, female (% of children under 5)
SH.STA.WAST.MA.ZS | Prevalence of wasting, weight for height, male (% of children under 5)
SH.STA.WAST.ZS | Prevalence of wasting, weight for height (% of children under 5)
SH.SVR.WAST.FE.ZS | Prevalence of severe wasting, weight for height, female (% of children under 5)
SH.SVR.WAST.MA.ZS | Prevalence of severe wasting, weight for height, male (% of children under 5)
SH.SVR.WAST.ZS | Prevalence of severe wasting, weight for height (% of children under 5)
SH.TBS.CURE.ZS | Tuberculosis treatment success rate (% of new cases)
SH.TBS.DTEC.ZS | Tuberculosis case detection rate (%, all forms)
SH.TBS.INCD | Incidence of tuberculosis (per 100,000 people)
SH.TBS.MORT | Tuberculosis death rate (per 100,000 people)
SH.TBS.PREV | Prevalence of tuberculosis (per 100,000 population)
SH.VAC.TTNS.ZS | Newborns protected against tetanus (%)
SH.XPD.EXTR.ZS | External resources for health (% of total expenditure on health)
SH.XPD.OOPC.TO.ZS | Out-of-pocket health expenditure (% of total expenditure on health)
SH.XPD.OOPC.ZS | Out-of-pocket health expenditure (% of private expenditure on health)
SH.XPD.PCAP | Health expenditure per capita (current US$)
SH.XPD.PCAP.PP.KD | Health expenditure per capita, PPP (constant 2011 international $)
SH.XPD.PRIV | Health expenditure, private (% of total health expenditure)
SH.XPD.PRIV.ZS | Health expenditure, private (% of GDP)
SH.XPD.PUBL | Health expenditure, public (% of total health expenditure)
SH.XPD.PUBL.GX.ZS | Health expenditure, public (% of government expenditure)
SH.XPD.PUBL.ZS | Health expenditure, public (% of GDP)
SH.XPD.TOTL.CD | Health expenditure, total (current US$)
SH.XPD.TOTL.ZS | Health expenditure, total (% of GDP)
SI.POV.NAHC | Poverty headcount ratio at national poverty lines (% of population)
SI.POV.RUHC | Rural poverty headcount ratio at national poverty lines (% of rural population)
SI.POV.URHC | Urban poverty headcount ratio at national poverty lines (% of urban population)
SL.EMP.INSV.FE.ZS | Share of women in wage employment in the nonagricultural sector (% of total nonagricultural employment)
SL.TLF.TOTL.FE.ZS | Labor force, female (% of total labor force)
SL.TLF.TOTL.IN | Labor force, total
SL.UEM.TOTL.FE.ZS | Unemployment, female (% of female labor force) (modeled ILO estimate)
SL.UEM.TOTL.MA.ZS | Unemployment, male (% of male labor force) (modeled ILO estimate)
SL.UEM.TOTL.ZS | Unemployment, total (% of total labor force) (modeled ILO estimate)
SM.POP.NETM | Net migration
SN.ITK.DEFC | Number of people who are undernourished
SN.ITK.DEFC.ZS | Prevalence of undernourishment (% of population)
SN.ITK.SALT.ZS | Consumption of iodized salt (% of households)
SN.ITK.VITA.ZS | Vitamin A supplementation coverage rate (% of children ages 6-59 months)
SP.ADO.TFRT | Adolescent fertility rate (births per 1,000 women ages 15-19)
SP.DYN.AMRT.FE | Mortality rate, adult, female (per 1,000 female adults)
SP.DYN.AMRT.MA | Mortality rate, adult, male (per 1,000 male adults)
SP.DYN.CBRT.IN | Birth rate, crude (per 1,000 people)
SP.DYN.CDRT.IN | Death rate, crude (per 1,000 people)
SP.DYN.CONU.ZS | Contraceptive prevalence (% of women ages 15-49)
SP.DYN.IMRT.FE.IN | Mortality rate, infant, female (per 1,000 live births)
SP.DYN.IMRT.IN | Mortality rate, infant (per 1,000 live births)
SP.DYN.IMRT.MA.IN | Mortality rate, infant, male (per 1,000 live births)
SP.DYN.LE00.FE.IN | Life expectancy at birth, female (years)
SP.DYN.LE00.IN | Life expectancy at birth, total (years)
SP.DYN.LE00.MA.IN | Life expectancy at birth, male (years)
SP.DYN.SMAM.FE | Mean age at first marriage, female
SP.DYN.SMAM.MA | Mean age at first marriage, male
SP.DYN.TFRT.IN | Fertility rate, total (births per woman)
SP.DYN.TO65.FE.ZS | Survival to age 65, female (% of cohort)
SP.DYN.TO65.MA.ZS | Survival to age 65, male (% of cohort)
SP.DYN.WFRT | Wanted fertility rate (births per woman)
SP.HOU.FEMA.ZS | Female headed households (% of households with a female head)
SP.MTR.1519.ZS | Teenage mothers (% of women ages 15-19 who have had children or are currently pregnant)
SP.POP.0004.FE | Population ages 0-4, female
SP.POP.0004.FE.5Y | Population ages 0-4, female (% of female population)
SP.POP.0004.MA | Population ages 0-4, male
SP.POP.0004.MA.5Y | Population ages 0-4, male (% of male population)
SP.POP.0014.FE.ZS | Population ages 0-14, female (% of total)
SP.POP.0014.MA.ZS | Population ages 0-14, male (% of total)
SP.POP.0014.TO | Population ages 0-14, total
SP.POP.0014.TO.ZS | Population ages 0-14 (% of total)
SP.POP.0509.FE | Population ages 5-9, female
SP.POP.0509.FE.5Y | Population ages 5-9, female (% of female population)
SP.POP.0509.MA | Population ages 5-9, male
SP.POP.0509.MA.5Y | Population ages 5-9, male (% of male population)
SP.POP.1014.FE | Population ages 10-14, female
SP.POP.1014.FE.5Y | Population ages 10-14, female (% of female population)
SP.POP.1014.MA | Population ages 10-14, male
SP.POP.1014.MA.5Y | Population ages 10-14, male (% of male population)
SP.POP.1519.FE | Population ages 15-19, female
SP.POP.1519.FE.5Y | Population ages 15-19, female (% of female population)
SP.POP.1519.MA | Population ages 15-19, male
SP.POP.1519.MA.5Y | Population ages 15-19, male (% of male population)
SP.POP.1564.FE.ZS | Population ages 15-64, female (% of total)
SP.POP.1564.MA.ZS | Population ages 15-64, male (% of total)
SP.POP.1564.TO | Population ages 15-64, total
SP.POP.1564.TO.ZS | Population ages 15-64 (% of total)
SP.POP.2024.FE | Population ages 20-24, female
SP.POP.2024.FE.5Y | Population ages 20-24, female (% of female population)
SP.POP.2024.MA | Population ages 20-24, male
SP.POP.2024.MA.5Y | Population ages 20-24, male (% of male population)
SP.POP.2529.FE | Population ages 25-29, female
SP.POP.2529.FE.5Y | Population ages 25-29, female (% of female population)
SP.POP.2529.MA | Population ages 25-29, male
SP.POP.2529.MA.5Y | Population ages 25-29, male (% of male population)
SP.POP.3034.FE | Population ages 30-34, female
SP.POP.3034.FE.5Y | Population ages 30-34, female (% of female population)
SP.POP.3034.MA | Population ages 30-34, male
SP.POP.3034.MA.5Y | Population ages 30-34, male (% of male population)
SP.POP.3539.FE | Population ages 35-39, female
SP.POP.3539.FE.5Y | Population ages 35-39, female (% of female population)
SP.POP.3539.MA | Population ages 35-39, male
SP.POP.3539.MA.5Y | Population ages 35-39, male (% of male population)
SP.POP.4044.FE | Population ages 40-44, female
SP.POP.4044.FE.5Y | Population ages 40-44, female (% of female population)
SP.POP.4044.MA | Population ages 40-44, male
SP.POP.4044.MA.5Y | Population ages 40-44, male (% of male population)
SP.POP.4549.FE | Population ages 45-49, female
SP.POP.4549.FE.5Y | Population ages 45-49, female (% of female population)
SP.POP.4549.MA | Population ages 45-49, male
SP.POP.4549.MA.5Y | Population ages 45-49, male (% of male population)
SP.POP.5054.FE | Population ages 50-54, female
SP.POP.5054.FE.5Y | Population ages 50-54, female (% of female population)
SP.POP.5054.MA | Population ages 50-54, male
SP.POP.5054.MA.5Y | Population ages 50-54, male (% of male population)
SP.POP.5559.FE | Population ages 55-59, female
SP.POP.5559.FE.5Y | Population ages 55-59, female (% of female population)
SP.POP.5559.MA | Population ages 55-59, male
SP.POP.5559.MA.5Y | Population ages 55-59, male (% of male population)
SP.POP.6064.FE | Population ages 60-64, female
SP.POP.6064.FE.5Y | Population ages 60-64, female (% of female population)
SP.POP.6064.MA | Population ages 60-64, male
SP.POP.6064.MA.5Y | Population ages 60-64, male (% of male population)
SP.POP.6569.FE | Population ages 65-69, female
SP.POP.6569.FE.5Y | Population ages 65-69, female (% of female population)
SP.POP.6569.MA | Population ages 65-69, male
SP.POP.6569.MA.5Y | Population ages 65-69, male (% of male population)
SP.POP.65UP.FE.ZS | Population ages 65 and above, female (% of total)
SP.POP.65UP.MA.ZS | Population ages 65 and above, male (% of total)
SP.POP.65UP.TO | Population ages 65 and above, total
SP.POP.65UP.TO.ZS | Population ages 65 and above (% of total)
SP.POP.7074.FE | Population ages 70-74, female
SP.POP.7074.FE.5Y | Population ages 70-74, female (% of female population)
SP.POP.7074.MA | Population ages 70-74, male
SP.POP.7074.MA.5Y | Population ages 70-74, male (% of male population)
SP.POP.7579.FE | Population ages 75-79, female
SP.POP.7579.FE.5Y | Population ages 75-79, female (% of female population)
SP.POP.7579.MA | Population ages 75-79, male
SP.POP.7579.MA.5Y | Population ages 75-79, male (% of male population)
SP.POP.80UP.FE | Population ages 80 and above, female
SP.POP.80UP.FE.5Y | Population ages 80 and above, female (% of female population)
SP.POP.80UP.MA | Population ages 80 and above, male
SP.POP.80UP.MA.5Y | Population ages 80 and above, male (% of male population)
SP.POP.AG00.FE.IN | Age population, age 0, female, interpolated
SP.POP.AG00.MA.IN | Age population, age 0, male, interpolated
SP.POP.AG01.FE.IN | Age population, age 01, female, interpolated
SP.POP.AG01.MA.IN | Age population, age 01, male, interpolated
SP.POP.AG02.FE.IN | Age population, age 02, female, interpolated
SP.POP.AG02.MA.IN | Age population, age 02, male, interpolated
SP.POP.AG03.FE.IN | Age population, age 03, female, interpolated
SP.POP.AG03.MA.IN | Age population, age 03, male, interpolated
SP.POP.AG04.FE.IN | Age population, age 04, female, interpolated
SP.POP.AG04.MA.IN | Age population, age 04, male, interpolated
SP.POP.AG05.FE.IN | Age population, age 05, female, interpolated
SP.POP.AG05.MA.IN | Age population, age 05, male, interpolated
SP.POP.AG06.FE.IN | Age population, age 06, female, interpolated
SP.POP.AG06.MA.IN | Age population, age 06, male, interpolated
SP.POP.AG07.FE.IN | Age population, age 07, female, interpolated
SP.POP.AG07.MA.IN | Age population, age 07, male, interpolated
SP.POP.AG08.FE.IN | Age population, age 08, female, interpolated
SP.POP.AG08.MA.IN | Age population, age 08, male, interpolated
SP.POP.AG09.FE.IN | Age population, age 09, female, interpolated
SP.POP.AG09.MA.IN | Age population, age 09, male, interpolated
SP.POP.AG10.FE.IN | Age population, age 10, female, interpolated
SP.POP.AG10.MA.IN | Age population, age 10, male
SP.POP.AG11.FE.IN | Age population, age 11, female, interpolated
SP.POP.AG11.MA.IN | Age population, age 11, male
SP.POP.AG12.FE.IN | Age population, age 12, female, interpolated
SP.POP.AG12.MA.IN | Age population, age 12, male
SP.POP.AG13.FE.IN | Age population, age 13, female, interpolated
SP.POP.AG13.MA.IN | Age population, age 13, male
SP.POP.AG14.FE.IN | Age population, age 14, female, interpolated
SP.POP.AG14.MA.IN | Age population, age 14, male
SP.POP.AG15.FE.IN | Age population, age 15, female, interpolated
SP.POP.AG15.MA.IN | Age population, age 15, male, interpolated
SP.POP.AG16.FE.IN | Age population, age 16, female, interpolated
SP.POP.AG16.MA.IN | Age population, age 16, male, interpolated
SP.POP.AG17.FE.IN | Age population, age 17, female, interpolated
SP.POP.AG17.MA.IN | Age population, age 17, male, interpolated
SP.POP.AG18.FE.IN | Age population, age 18, female, interpolated
SP.POP.AG18.MA.IN | Age population, age 18, male, interpolated
SP.POP.AG19.FE.IN | Age population, age 19, female, interpolated
SP.POP.AG19.MA.IN | Age population, age 19, male, interpolated
SP.POP.AG20.FE.IN | Age population, age 20, female, interpolated
SP.POP.AG20.MA.IN | Age population, age 20, male, interpolated
SP.POP.AG21.FE.IN | Age population, age 21, female, interpolated
SP.POP.AG21.MA.IN | Age population, age 21, male, interpolated
SP.POP.AG22.FE.IN | Age population, age 22, female, interpolated
SP.POP.AG22.MA.IN | Age population, age 22, male, interpolated
SP.POP.AG23.FE.IN | Age population, age 23, female, interpolated
SP.POP.AG23.MA.IN | Age population, age 23, male, interpolated
SP.POP.AG24.FE.IN | Age population, age 24, female, interpolated
SP.POP.AG24.MA.IN | Age population, age 24, male, interpolated
SP.POP.AG25.FE.IN | Age population, age 25, female, interpolated
SP.POP.AG25.MA.IN | Age population, age 25, male, interpolated
SP.POP.BRTH.MF | Sex ratio at birth (male births per female births)
SP.POP.DPND | Age dependency ratio (% of working-age population)
SP.POP.DPND.OL | Age dependency ratio, old (% of working-age population)
SP.POP.DPND.YG | Age dependency ratio, young (% of working-age population)
SP.POP.GROW | Population growth (annual %)
SP.POP.TOTL | Population, total
SP.POP.TOTL.FE.IN | Population, female
SP.POP.TOTL.FE.ZS | Population, female (% of total)
SP.POP.TOTL.MA.IN | Population, male
SP.POP.TOTL.MA.ZS | Population, male (% of total)
SP.REG.BRTH.RU.ZS | Completeness of birth registration, rural (%)
SP.REG.BRTH.UR.ZS | Completeness of birth registration, urban (%)
SP.REG.BRTH.ZS | Completeness of birth registration (%)
SP.REG.DTHS.ZS | Completeness of death registration with cause-of-death information (%)
SP.RUR.TOTL | Rural population
SP.RUR.TOTL.ZG | Rural population growth (annual %)
SP.RUR.TOTL.ZS | Rural population (% of total population)
SP.URB.GROW | Urban population growth (annual %)
SP.URB.TOTL | Urban population
SP.URB.TOTL.IN.ZS | Urban population (% of total)
SP.UWT.TFRT | Unmet need for contraception (% of married women ages 15-49)
