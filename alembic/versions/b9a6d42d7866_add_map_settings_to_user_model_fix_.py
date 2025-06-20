"""Add map settings to User model - Fix PostGIS

Revision ID: b9a6d42d7866
Revises: 
Create Date: 2025-06-19 11:37:31.920349

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'b9a6d42d7866'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_index('nsw_roads_geom_idx', table_name='nsw_roads', postgresql_using='gist')
    op.drop_table('nsw_roads')
    op.drop_table('offers_summary')
    op.drop_index('nsw_land_zones_geom_idx', table_name='nsw_landzones', postgresql_using='gist')
    op.drop_table('nsw_landzones')
    op.drop_index('idx_addresses_geom', table_name='addresses', postgresql_using='gist')
    op.drop_table('addresses')
    op.drop_table('user')
    op.drop_table('nsw_addresses')
    op.drop_index('nsw_lots_geom_idx', table_name='nsw_lots', postgresql_using='gist')
    op.drop_table('nsw_lots')
    op.add_column('users', sa.Column('map_zoom_level', sa.Float(), nullable=True))
    op.add_column('users', sa.Column('map_latitude', sa.Float(), nullable=True))
    op.add_column('users', sa.Column('map_longitude', sa.Float(), nullable=True))
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column('users', 'map_longitude')
    op.drop_column('users', 'map_latitude')
    op.drop_column('users', 'map_zoom_level')
    op.create_table('nsw_lots',
    sa.Column('gid', sa.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('geom', sa.NullType(), autoincrement=False, nullable=True),
    sa.Column('number_fir', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('street_nam', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('street_typ', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('locality_n', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('state_abbr', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('status', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('username', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('icon', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('date', sa.DATE(), autoincrement=False, nullable=True),
    sa.Column('time', postgresql.TIME(), autoincrement=False, nullable=True),
    sa.Column('offer', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('comment', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('frontage', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('sqm', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('address', sa.TEXT(), autoincrement=False, nullable=True),
    sa.PrimaryKeyConstraint('gid', name='nsw_lots_pkey')
    )
    op.create_index('nsw_lots_geom_idx', 'nsw_lots', ['geom'], unique=False, postgresql_using='gist')
    op.create_table('nsw_addresses',
    sa.Column('legal_parcel_id', sa.VARCHAR(length=20), autoincrement=False, nullable=True),
    sa.Column('number_first', sa.NUMERIC(precision=6, scale=0), autoincrement=False, nullable=True),
    sa.Column('street_name', sa.VARCHAR(length=100), autoincrement=False, nullable=True),
    sa.Column('street_type_code', sa.VARCHAR(length=15), autoincrement=False, nullable=True),
    sa.Column('locality_name', sa.VARCHAR(length=100), autoincrement=False, nullable=True),
    sa.Column('state_abbreviation', sa.VARCHAR(length=3), autoincrement=False, nullable=True),
    sa.Column('latitude', sa.NUMERIC(precision=10, scale=8), autoincrement=False, nullable=True),
    sa.Column('longitude', sa.NUMERIC(precision=11, scale=8), autoincrement=False, nullable=True),
    sa.Column('status', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('user', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('icon', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('geom', sa.NullType(), autoincrement=False, nullable=True)
    )
    op.create_table('user',
    sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('username', sa.VARCHAR(length=25), autoincrement=False, nullable=False),
    sa.Column('email', sa.VARCHAR(length=120), autoincrement=False, nullable=False),
    sa.Column('password_hash', sa.VARCHAR(length=100), autoincrement=False, nullable=False),
    sa.Column('reset_token', sa.VARCHAR(length=100), autoincrement=False, nullable=True),
    sa.Column('latitude', sa.DOUBLE_PRECISION(precision=53), autoincrement=False, nullable=True),
    sa.Column('longitude', sa.DOUBLE_PRECISION(precision=53), autoincrement=False, nullable=True),
    sa.Column('zoom', sa.INTEGER(), autoincrement=False, nullable=True),
    sa.PrimaryKeyConstraint('id', name='user_pkey'),
    sa.UniqueConstraint('email', name='user_email_key'),
    sa.UniqueConstraint('username', name='user_username_key')
    )
    op.create_table('addresses',
    sa.Column('legal_parcel_id', sa.VARCHAR(length=20), autoincrement=False, nullable=True),
    sa.Column('number_first', sa.NUMERIC(precision=6, scale=0), autoincrement=False, nullable=True),
    sa.Column('street_name', sa.VARCHAR(length=100), autoincrement=False, nullable=True),
    sa.Column('street_type_code', sa.VARCHAR(length=15), autoincrement=False, nullable=True),
    sa.Column('locality_name', sa.VARCHAR(length=100), autoincrement=False, nullable=True),
    sa.Column('state_abbreviation', sa.VARCHAR(length=3), autoincrement=False, nullable=True),
    sa.Column('latitude', sa.NUMERIC(precision=10, scale=8), autoincrement=False, nullable=True),
    sa.Column('longitude', sa.NUMERIC(precision=11, scale=8), autoincrement=False, nullable=True),
    sa.Column('status', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('user', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('icon', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('geom', sa.NullType(), autoincrement=False, nullable=True)
    )
    op.create_index('idx_addresses_geom', 'addresses', ['geom'], unique=False, postgresql_using='gist')
    op.create_table('nsw_landzones',
    sa.Column('gid', sa.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('epi_name', sa.VARCHAR(length=150), autoincrement=False, nullable=True),
    sa.Column('lga_code', sa.DOUBLE_PRECISION(precision=53), autoincrement=False, nullable=True),
    sa.Column('lga_name', sa.VARCHAR(length=50), autoincrement=False, nullable=True),
    sa.Column('published_', sa.DATE(), autoincrement=False, nullable=True),
    sa.Column('commenced_', sa.DATE(), autoincrement=False, nullable=True),
    sa.Column('currency_d', sa.DATE(), autoincrement=False, nullable=True),
    sa.Column('amendment', sa.VARCHAR(length=150), autoincrement=False, nullable=True),
    sa.Column('map_type', sa.VARCHAR(length=4), autoincrement=False, nullable=True),
    sa.Column('map_name', sa.VARCHAR(length=100), autoincrement=False, nullable=True),
    sa.Column('lay_name', sa.VARCHAR(length=100), autoincrement=False, nullable=True),
    sa.Column('lay_class', sa.VARCHAR(length=100), autoincrement=False, nullable=True),
    sa.Column('label', sa.VARCHAR(length=254), autoincrement=False, nullable=True),
    sa.Column('sym_code', sa.VARCHAR(length=10), autoincrement=False, nullable=True),
    sa.Column('purpose', sa.VARCHAR(length=254), autoincrement=False, nullable=True),
    sa.Column('comments', sa.VARCHAR(length=100), autoincrement=False, nullable=True),
    sa.Column('legis_ref_', sa.VARCHAR(length=50), autoincrement=False, nullable=True),
    sa.Column('legis_ref1', sa.VARCHAR(length=50), autoincrement=False, nullable=True),
    sa.Column('legis_re_1', sa.VARCHAR(length=50), autoincrement=False, nullable=True),
    sa.Column('created_us', sa.VARCHAR(length=254), autoincrement=False, nullable=True),
    sa.Column('created_da', sa.DATE(), autoincrement=False, nullable=True),
    sa.Column('last_edite', sa.VARCHAR(length=254), autoincrement=False, nullable=True),
    sa.Column('last_edi_1', sa.DATE(), autoincrement=False, nullable=True),
    sa.Column('pco_ref_ke', sa.VARCHAR(length=50), autoincrement=False, nullable=True),
    sa.Column('epi_type', sa.VARCHAR(length=5), autoincrement=False, nullable=True),
    sa.Column('cadid', sa.DOUBLE_PRECISION(precision=53), autoincrement=False, nullable=True),
    sa.Column('shape_leng', sa.NUMERIC(), autoincrement=False, nullable=True),
    sa.Column('shape_area', sa.NUMERIC(), autoincrement=False, nullable=True),
    sa.Column('geom', sa.NullType(), autoincrement=False, nullable=True),
    sa.PrimaryKeyConstraint('gid', name='nsw_land_zones_pkey')
    )
    op.create_index('nsw_land_zones_geom_idx', 'nsw_landzones', ['geom'], unique=False, postgresql_using='gist')
    op.create_table('offers_summary',
    sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('remark', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('date', sa.DATE(), autoincrement=False, nullable=True),
    sa.Column('time', postgresql.TIME(), autoincrement=False, nullable=True),
    sa.Column('street_number', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('street_name', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('suburb', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('state', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('username', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('frontage', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('sqm', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('offer', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('comment', sa.TEXT(), autoincrement=False, nullable=True),
    sa.PrimaryKeyConstraint('id', name='offers_summary_pkey')
    )
    op.create_table('nsw_roads',
    sa.Column('gid', sa.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('osm_id', sa.VARCHAR(length=12), autoincrement=False, nullable=True),
    sa.Column('code', sa.INTEGER(), autoincrement=False, nullable=True),
    sa.Column('fclass', sa.VARCHAR(length=28), autoincrement=False, nullable=True),
    sa.Column('name', sa.VARCHAR(length=100), autoincrement=False, nullable=True),
    sa.Column('geom', sa.NullType(), autoincrement=False, nullable=True),
    sa.PrimaryKeyConstraint('gid', name='nsw_roads_pkey')
    )
    op.create_index('nsw_roads_geom_idx', 'nsw_roads', ['geom'], unique=False, postgresql_using='gist')
    # ### end Alembic commands ###
