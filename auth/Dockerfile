FROM public.ecr.aws/lambda/python:3.12

COPY ./requirements.txt ${LAMBDA_TASK_ROOT}
RUN pip install --no-cache-dir -r requirements.txt

COPY auth.py ${LAMBDA_TASK_ROOT}
EXPOSE 8080
CMD ["auth.lambda_handler"]
