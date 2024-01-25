import { Test, TestingModule } from '@nestjs/testing';
import { DesmosMorpheusService } from './desmos-morpheus.service';

describe('DesmosMorpheusService', () => {
  let service: DesmosMorpheusService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DesmosMorpheusService],
    }).compile();

    service = module.get<DesmosMorpheusService>(DesmosMorpheusService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
