from superset import (
    app,
    talisman
)
from flask import (
    render_template,
    request
)
import psycopg2
import plotly.express as px
import plotly.io as io
import pandas as pd
from pandas import read_sql
import plotly.graph_objects as go

USUARIO_BD = ""
SENHA_BD = ""

@talisman(force_https=False)
@app.route("/boletim_covid")
def boletim_covid():
    full_view = request.args.get('full', default=False, type=bool)
    connection = psycopg2.connect('postgresql://' + USUARIO_BD + ':' + SENHA_BD + '@192.168.0.100:5433/target_pb')
    cursor = connection.cursor()
    cursor.execute('select * from boletim_covid')
    result = cursor.fetchone()
    print(pd.DataFrame(list(result)))
    pagina = render_template('facilit/boletim.html', uti_ocupacao_paraiba=str(result[0]) + '%', enfermaria_ocupacao_paraiba=str(result[1]) + '%',uti_ocupacao_grandejp=str(result[2]) + '%',
                                         enfermaria_ocupacao_grandejp=str(result[3]) + '%', uti_ocupacao_campinagrande=str(result[4]) + '%',
                                         enfermaria_ocupacao_campinagrande=str(result[5]) + '%', uti_ocupacao_sertao=str(result[6]) + '%',
                                         enfermaria_ocupacao_sertao=str(result[7]) + '%', casos_confirmados=result[8], casos_descartados=result[9], obitos_confirmados=result[10],
                                         recuperados=result[11], qtd_cidades=result[12], data_atualizacao=result[13], full=full_view)
    cursor.close()
    connection.close()
    return pagina

@talisman(force_https=False)
@app.route("/trend_paraiba")
def trend_paraiba():
   panda_query = read_sql('''select data as data_casos, "casosNovos" as casos_novos, avg("casosNovos") over (order by data rows between 6 preceding and current row) pcn 
   from "SES_PB" group by data, "casosNovos" order by data''','postgresql://' + USUARIO_BD + ':' + SENHA_BD + '@192.168.0.100:5433/target_pb')
   
   data = [
       go.Bar(
           x=panda_query['data_casos'],
           y=panda_query['casos_novos'],
           name='Casos por dia',
           hovertemplate='Data: %{x}<br>Casos confirmados: %{y}'           
       ),
       go.Scatter(
           x=panda_query['data_casos'],
           y=panda_query['pcn'],
           name='PCN'
       )
   ]
   layout = go.Layout(
           xaxis=go.layout.XAxis(tickmode='auto')
      
   )
   fig = go.Figure(data=data,layout=layout)
   pagina = io.to_html(fig)
   return pagina
