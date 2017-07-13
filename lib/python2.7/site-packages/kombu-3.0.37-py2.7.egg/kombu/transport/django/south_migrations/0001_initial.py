# encoding: utf-8
from __future__ import absolute_import

# flake8: noqa
import datetime
from south.db import db
from south.v2 import SchemaMigration
from django.db import models

class Migration(SchemaMigration):

    def forwards(self, orm):

        # Adding model 'Queue'
        db.create_table('djkombu_queue', (
            ('id', self.gf('django.db.models.fields.AutoField')(primary_key=True)),
            ('name', self.gf('django.db.models.fields.CharField')(unique=True, max_length=200)),
        ))
        db.send_create_signal('django', ['Queue'])

        # Adding model 'Message'
        db.create_table('djkombu_message', (
            ('id', self.gf('django.db.models.fields.AutoField')(primary_key=True)),
            ('visible', self.gf('django.db.models.fields.BooleanField')(default=True, db_index=True)),
            ('sent_at', self.gf('django.db.models.fields.DateTimeField')(auto_now_add=True, null=True, db_index=True, blank=True)),
            ('payload', self.gf('django.db.models.fields.TextField')()),
            ('queue', self.gf('django.db.models.fields.related.ForeignKey')(related_name='messages', to=orm['django.Queue'])),
        ))
        db.send_create_signal('django', ['Message'])


    def backwards(self, orm):

        # Deleting model 'Queue'
        db.delete_table('djkombu_queue')

        # Deleting model 'Message'
        db.delete_table('djkombu_message')


    models = {
        'django.message': {
            'Meta': {'object_name': 'Message', 'db_table': "'djkombu_message'"},
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'payload': ('django.db.models.fields.TextField', [], {}),
            'queue': ('django.db.models.fields.related.ForeignKey', [], {'related_name': "'messages'", 'to': "orm['django.Queue']"}),
            'sent_at': ('django.db.models.fields.DateTimeField', [], {'auto_now_add': 'True', 'null': 'True', 'db_index': 'True', 'blank': 'True'}),
            'visible': ('django.db.models.fields.BooleanField', [], {'default': 'True', 'db_index': 'True'})
        },
        'django.queue': {
            'Meta': {'object_name': 'Queue', 'db_table': "'djkombu_queue'"},
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'unique': 'True', 'max_length': '200'})
        }
    }

    complete_apps = ['django']
