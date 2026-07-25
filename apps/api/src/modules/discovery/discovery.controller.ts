import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators';
import { DiscoveryService } from './discovery.service';
import { DiscoveryQueryDto, MapPinsQueryDto } from './dto/discovery.dto';

@ApiTags('discovery')
@Controller()
export class DiscoveryController {
  constructor(private readonly discovery: DiscoveryService) {}

  @Public()
  @Get('map/pins')
  @ApiOperation({
    summary: 'Institute pins for the current map viewport',
    description:
      'Radius and bounding-box filters are resolved by PostGIS using the GIST ' +
      'index on institutes.location. Clustering is performed on the client.',
  })
  mapPins(@Query() query: MapPinsQueryDto) {
    return this.discovery.mapPins(query);
  }

  @Public()
  @Get('institutes')
  @ApiOperation({ summary: 'Paginated institute cards (list view)' })
  list(@Query() query: DiscoveryQueryDto) {
    return this.discovery.listInstitutes(query);
  }

  @Public()
  @Get('categories')
  @ApiOperation({ summary: 'Categories with published-institute counts' })
  @ApiOkResponse({ description: 'Ordered by display position' })
  categories() {
    return this.discovery.listCategories();
  }

  @Public()
  @Get('skills')
  @ApiOperation({ summary: 'Most common skills, for filter chips' })
  skills() {
    return this.discovery.listSkills();
  }

  @Public()
  @Get('institutes/:slug')
  @ApiOperation({ summary: 'Institute storefront by slug or id' })
  storefront(@Param('slug') slug: string) {
    return this.discovery.getStorefront(slug);
  }

  @Public()
  @Get('institutes/:id/nearby')
  @ApiOperation({ summary: 'Institutes within 10 km of the given institute' })
  nearby(@Param('id', ParseUUIDPipe) id: string) {
    return this.discovery.nearby(id);
  }
}
